"""
Paso 1: Escáner y Constructor del Catálogo Maestro de Eduteka.pe
Mapea todas las universidades, exámenes, áreas académicas y preguntas.
Crea la base de datos de índice SQLite en dataset_eduteka/eduteka_index.sqlite.
"""

import concurrent.futures
import math
import os
import re
import sqlite3
import sys
import time
from pathlib import Path
from typing import Dict, List, Set, Tuple
import requests

BASE_URL = "https://eduteka.pe"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
HEADERS = {"User-Agent": USER_AGENT}

DB_PATH = Path("dataset_eduteka") / "eduteka_index.sqlite"


def init_db(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    cur.execute("""
    CREATE TABLE IF NOT EXISTS areas (
        slug TEXT PRIMARY KEY,
        name TEXT,
        total_questions INTEGER,
        total_pages INTEGER
    );
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS universities (
        slug TEXT PRIMARY KEY,
        name TEXT,
        url TEXT
    );
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS exams (
        slug TEXT PRIMARY KEY,
        title TEXT,
        university_slug TEXT,
        url TEXT,
        question_count INTEGER DEFAULT 0
    );
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS index_questions (
        uuid TEXT PRIMARY KEY,
        area_slug TEXT,
        university_slug TEXT,
        exam_slug TEXT,
        discovered_source TEXT,
        status TEXT DEFAULT 'pending'
    );
    """)
    conn.commit()
    return conn


def get_html(url: str, retries: int = 3) -> str:
    for attempt in range(retries):
        try:
            res = requests.get(url, headers=HEADERS, timeout=15)
            if res.status_code == 200:
                return res.text
            elif res.status_code == 404:
                return ""
        except Exception:
            time.sleep(1)
    return ""


# ─────────────────────────────────────────────────────────────
# 1. Escaneo de Áreas Académicas
# ─────────────────────────────────────────────────────────────
def scan_areas(conn: sqlite3.Connection) -> List[Tuple[str, str, int, int]]:
    print("\n[1/3] Escaneando catálogo de Áreas Académicas (/preguntas/areas)...")
    html = get_html(f"{BASE_URL}/preguntas/areas")
    pattern = r'(?s)<a href="/preguntas/area/([^"]+)"[^>]*>(.*?)</a>\s*<div[^>]*>\s*([0-9]+)\s*preguntas</div>'
    
    matches = re.findall(pattern, html)
    areas = []
    cur = conn.cursor()
    
    for slug, name, total_str in matches:
        slug = slug.strip()
        name = name.strip()
        total = int(total_str)
        pages = math.ceil(total / 20) if total > 0 else 1
        areas.append((slug, name, total, pages))
        cur.execute(
            "INSERT OR REPLACE INTO areas (slug, name, total_questions, total_pages) VALUES (?, ?, ?, ?)",
            (slug, name, total, pages),
        )
    conn.commit()
    print(f"-> {len(areas)} áreas académicas registradas.")
    return areas


# ─────────────────────────────────────────────────────────────
# 2. Escaneo de Universidades y sus Exámenes
# ─────────────────────────────────────────────────────────────
def scan_universities_and_exams(conn: sqlite3.Connection):
    print("\n[2/3] Escaneando Universidades y Exámenes de Admisión...")
    html = get_html(f"{BASE_URL}/examenes/universidades")
    
    # Encontrar todas las rutas de universidades: /examenes-<sigla>
    uni_pattern = r'href="(/examenes-([a-z0-9-]+))"'
    uni_matches = re.findall(uni_pattern, html)
    uni_routes = list(set(uni_matches))
    
    cur = conn.cursor()
    for full_path, uni_code in uni_routes:
        uni_name = uni_code.upper().replace("-", " ")
        cur.execute(
            "INSERT OR REPLACE INTO universities (slug, name, url) VALUES (?, ?, ?)",
            (uni_code, uni_name, f"{BASE_URL}{full_path}"),
        )
    conn.commit()
    print(f"-> {len(uni_routes)} universidades identificadas.")

    # Escanear exámenes de cada universidad
    total_exams = 0
    uuid_pattern = r'([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})'

    for full_path, uni_code in uni_routes:
        uni_url = f"{BASE_URL}{full_path}"
        uni_html = get_html(uni_url)
        exam_links = list(set(re.findall(r'href="(/examenes/([^"]+))"', uni_html)))
        
        for exam_path, exam_slug in exam_links:
            if exam_slug in ["universidades", ""]:
                continue
            exam_url = f"{BASE_URL}{exam_path}"
            exam_title = exam_slug.replace("-", " ").title()
            
            # Obtener preguntas de este examen
            exam_html = get_html(exam_url)
            exam_uuids = list(set(re.findall(uuid_pattern, exam_html)))
            
            cur.execute(
                "INSERT OR REPLACE INTO exams (slug, title, university_slug, url, question_count) VALUES (?, ?, ?, ?, ?)",
                (exam_slug, exam_title, uni_code, exam_url, len(exam_uuids)),
            )
            
            for q_uuid in exam_uuids:
                cur.execute(
                    """
                    INSERT INTO index_questions (uuid, university_slug, exam_slug, discovered_source)
                    VALUES (?, ?, ?, 'exam')
                    ON CONFLICT(uuid) DO UPDATE SET 
                        university_slug=excluded.university_slug,
                        exam_slug=excluded.exam_slug
                    """,
                    (q_uuid, uni_code, exam_slug),
                )
            total_exams += 1
            if len(exam_uuids) > 0:
                print(f"   [{uni_code.upper()}] {exam_slug}: {len(exam_uuids)} preguntas indexadas.")
        conn.commit()
    print(f"-> {total_exams} exámenes registrados e indexados.")


# ─────────────────────────────────────────────────────────────
# 3. Escaneo de Preguntas por Área (Paginación)
# ─────────────────────────────────────────────────────────────
def scan_questions_for_area(area_tuple: Tuple[str, str, int, int]) -> Tuple[str, int]:
    slug, name, total, pages = area_tuple
    uuid_pattern = r'showModalAnswerQuestion\s*\(\s*event\s*,\s*[\'"]([a-f0-9-]+)[\'"]\s*\)'
    local_uuids: Set[str] = set()

    for page in range(1, pages + 1):
        url = f"{BASE_URL}/preguntas/area/{slug}?page={page}"
        html = get_html(url)
        found = re.findall(uuid_pattern, html)
        for u in found:
            local_uuids.add(u)

    # Insertar en base de datos
    local_conn = sqlite3.connect(DB_PATH)
    local_cur = local_conn.cursor()
    for uid in local_uuids:
        local_cur.execute(
            """
            INSERT INTO index_questions (uuid, area_slug, discovered_source)
            VALUES (?, ?, 'area')
            ON CONFLICT(uuid) DO UPDATE SET area_slug=excluded.area_slug
            """,
            (uid, slug),
        )
    local_conn.commit()
    local_conn.close()
    return slug, len(local_uuids)


def scan_all_area_questions(areas: List[Tuple[str, str, int, int]]):
    print("\n[3/3] Indexando preguntas de todas las Áreas Académicas...")
    
    # Usar ThreadPool para escanear en paralelo
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        future_to_area = {executor.submit(scan_questions_for_area, a): a for a in areas}
        completed = 0
        for future in concurrent.futures.as_completed(future_to_area):
            area = future_to_area[future]
            completed += 1
            try:
                slug, count = future.result()
                print(f"   ({completed:02d}/{len(areas):02d}) {slug}: {count} preguntas indexadas.")
            except Exception as e:
                print(f"   Error en {area[0]}: {e}")


# ─────────────────────────────────────────────────────────────
# Resumen y Métricas Finales
# ─────────────────────────────────────────────────────────────
def print_summary(conn: sqlite3.Connection):
    cur = conn.cursor()
    
    total_q = cur.execute("SELECT COUNT(*) FROM index_questions").fetchone()[0]
    total_areas = cur.execute("SELECT COUNT(*) FROM areas").fetchone()[0]
    total_unis = cur.execute("SELECT COUNT(*) FROM universities").fetchone()[0]
    total_exams = cur.execute("SELECT COUNT(*) FROM exams").fetchone()[0]

    print("\n" + "=" * 65)
    print("      CENSO MAESTRO COMPLETADO CON ÉXITO")
    print("=" * 65)
    print(f"-> Total Preguntas Únicas Indexadas : {total_q:,}")
    print(f"-> Total Áreas Académicas Censadas : {total_areas}")
    print(f"-> Total Universidades Mapeadas    : {total_unis}")
    print(f"-> Total Exámenes Catalogados      : {total_exams}")
    print(f"-> Base de Datos del Catálogo      : {DB_PATH.resolve()}")
    print("=" * 65)

    print("\nTop 10 Áreas por Cantidad de Preguntas:")
    for row in cur.execute("""
        SELECT a.name, COUNT(q.uuid) as c 
        FROM index_questions q 
        JOIN areas a ON q.area_slug = a.slug 
        GROUP BY a.name 
        ORDER BY c DESC LIMIT 10
    """):
        print(f"   • {row[0]}: {row[1]:,} preguntas")

    print("\nTop Exámenes de Universidades:")
    for row in cur.execute("""
        SELECT u.name, e.title, e.question_count 
        FROM exams e 
        JOIN universities u ON e.university_slug = u.slug 
        WHERE e.question_count > 0 
        ORDER BY e.question_count DESC LIMIT 10
    """):
        print(f"   • [{row[0]}] {row[1]}: {row[2]} preguntas")
    print("=" * 65)


def main():
    print("=" * 65)
    print("   INICIANDO PASO 1: ESCANEO Y CONSTRUCCIÓN DEL CATÁLOGO")
    print("=" * 65)
    start_time = time.time()
    
    conn = init_db(DB_PATH)
    areas = scan_areas(conn)
    scan_universities_and_exams(conn)
    scan_all_area_questions(areas)
    
    print_summary(conn)
    conn.close()
    
    elapsed = time.time() - start_time
    print(f"\nTiempo total de ejecución: {elapsed:.2f} segundos.")


if __name__ == "__main__":
    main()
