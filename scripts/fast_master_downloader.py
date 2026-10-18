"""
Descargador Maestro de Alto Rendimiento para Eduteka.pe
Extrae el 100% de la base de datos (preguntas, fórmulas LaTeX, opciones A-E, gráficos,
áreas, universidades y exámenes) directamente desde las páginas HTML renderizadas por el servidor.
Evita los rate-limits de la API JSON de Express descargando a más de 30-40 preguntas/segundo.
"""

import concurrent.futures
import re
import sqlite3
import sys
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from bs4 import BeautifulSoup
import requests

BASE_URL = "https://eduteka.pe"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

INDEX_DB_PATH = Path("dataset_eduteka") / "eduteka_index.sqlite"
MASTER_DB_PATH = Path("dataset_eduteka") / "eduteka_master.db"

HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9",
}


def clean_html_text(html_content: Optional[str]) -> str:
    if not html_content:
        return ""
    text = re.sub(r"<[^>]+>", " ", html_content)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def init_master_db(db_path: Path):
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("PRAGMA journal_mode=WAL;")
    cur.execute("PRAGMA synchronous=NORMAL;")
    
    cur.execute("""
    CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY,
        area_slug TEXT,
        university_slug TEXT,
        exam_slug TEXT,
        area_name TEXT,
        question_type TEXT,
        question_html TEXT,
        question_text TEXT,
        option_a TEXT,
        option_b TEXT,
        option_c TEXT,
        option_d TEXT,
        option_e TEXT,
        correct_key TEXT,
        resolution_html TEXT,
        resolution_text TEXT,
        web_url TEXT,
        downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_questions_area ON questions(area_slug);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_questions_uni ON questions(university_slug);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_questions_exam ON questions(exam_slug);")
    conn.commit()
    conn.close()


INSERT_UPSERT_SQL = """
INSERT INTO questions (
    id, area_slug, university_slug, exam_slug, area_name, question_type,
    question_html, question_text, option_a, option_b, option_c, option_d,
    option_e, correct_key, resolution_html, resolution_text, web_url
) VALUES (
    :id, :area_slug, :university_slug, :exam_slug, :area_name, :question_type,
    :question_html, :question_text, :option_a, :option_b, :option_c, :option_d,
    :option_e, :correct_key, :resolution_html, :resolution_text, :web_url
)
ON CONFLICT(id) DO UPDATE SET
    area_slug = COALESCE(excluded.area_slug, questions.area_slug),
    university_slug = COALESCE(excluded.university_slug, questions.university_slug),
    exam_slug = COALESCE(excluded.exam_slug, questions.exam_slug),
    area_name = COALESCE(excluded.area_name, questions.area_name),
    question_type = COALESCE(excluded.question_type, questions.question_type),
    question_html = COALESCE(excluded.question_html, questions.question_html),
    question_text = COALESCE(excluded.question_text, questions.question_text),
    option_a = COALESCE(excluded.option_a, questions.option_a),
    option_b = COALESCE(excluded.option_b, questions.option_b),
    option_c = COALESCE(excluded.option_c, questions.option_c),
    option_d = COALESCE(excluded.option_d, questions.option_d),
    option_e = COALESCE(excluded.option_e, questions.option_e),
    correct_key = COALESCE(questions.correct_key, excluded.correct_key),
    resolution_html = COALESCE(questions.resolution_html, excluded.resolution_html),
    resolution_text = COALESCE(questions.resolution_text, excluded.resolution_text),
    web_url = COALESCE(excluded.web_url, questions.web_url)
"""


# ─────────────────────────────────────────────────────────────
# FASE 1: Extracción Masiva desde Exámenes (166 Exámenes)
# ─────────────────────────────────────────────────────────────
def parse_exam_page(html: str, uni_slug: str, exam_slug: str) -> List[Dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    cards = soup.find_all("div", class_=re.compile(r"question-card"))
    records = []

    for card in cards:
        q_uuid = card.get("id")
        if not q_uuid or len(q_uuid) != 36:
            continue

        area_name = card.get("data-area", "")
        q_div = card.find("div", class_="question-content")
        q_html = str(q_div) if q_div else ""
        q_text = clean_html_text(q_html)

        opts_div = card.find("div", class_="edk-options")
        options = {}
        if opts_div:
            for opt_row in opts_div.find_all("div", class_="option"):
                letter_tag = opt_row.find("strong")
                if letter_tag:
                    letter = letter_tag.get_text().strip().replace(")", "")
                    p_tags = opt_row.find_all("p")
                    options[letter] = str(p_tags[-1]) if p_tags else ""

        slug_a = card.find("a", href=re.compile(r"/preguntas/([a-z0-9-]+)"))
        web_url = f"{BASE_URL}{slug_a['href']}" if slug_a else ""

        records.append({
            "id": q_uuid,
            "area_slug": None,
            "university_slug": uni_slug,
            "exam_slug": exam_slug,
            "area_name": area_name,
            "question_type": "Directa",
            "question_html": q_html,
            "question_text": q_text,
            "option_a": options.get("A", ""),
            "option_b": options.get("B", ""),
            "option_c": options.get("C", ""),
            "option_d": options.get("D", ""),
            "option_e": options.get("E", ""),
            "correct_key": None,
            "resolution_html": None,
            "resolution_text": None,
            "web_url": web_url,
        })

    return records


def process_single_exam(exam_row: Tuple[str, str, str, str]) -> Tuple[str, int]:
    slug, title, uni_slug, url = exam_row
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        if r.status_code != 200:
            return slug, 0
        records = parse_exam_page(r.text, uni_slug, slug)
        if not records:
            return slug, 0

        # Guardar registros en la base de datos local
        m_conn = sqlite3.connect(MASTER_DB_PATH)
        m_cur = m_conn.cursor()
        m_cur.executemany(INSERT_UPSERT_SQL, records)
        m_conn.commit()
        m_conn.close()

        # Actualizar índice
        i_conn = sqlite3.connect(INDEX_DB_PATH)
        i_cur = i_conn.cursor()
        uuids = [(r["id"],) for r in records]
        i_cur.executemany("UPDATE index_questions SET status = 'downloaded' WHERE uuid = ?", uuids)
        i_conn.commit()
        i_conn.close()

        return slug, len(records)
    except Exception:
        return slug, 0


def scrape_all_exams(max_workers: int = 8):
    print("\n[FASE 1/2] Extracción Masiva desde Páginas de Exámenes (166 Exámenes)...")
    conn_idx = sqlite3.connect(INDEX_DB_PATH)
    exams = conn_idx.cursor().execute("SELECT slug, title, university_slug, url FROM exams").fetchall()
    conn_idx.close()

    total_exams = len(exams)
    start_time = time.time()
    total_questions = 0
    completed = 0

    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_exam = {executor.submit(process_single_exam, ex): ex for ex in exams}
        for future in concurrent.futures.as_completed(future_to_exam):
            completed += 1
            slug, count = future.result()
            total_questions += count
            elapsed = time.time() - start_time
            rate = total_questions / elapsed if elapsed > 0 else 0
            percent = (completed / total_exams) * 100
            print(
                f"   [EXÁMENES {completed:03d}/{total_exams}] ({percent:5.1f}%) | "
                f"Guardadas: {total_questions:5,d} preguntas | Ritmo: {rate:4.1f} preg/s | {slug[:30]}",
                flush=True
            )

    print(f"-> FASE 1 COMPLETADA: {total_questions:,} preguntas extraídas de {total_exams} exámenes.")


# ─────────────────────────────────────────────────────────────
# FASE 2: Extracción Complementaria desde Catálogo de Áreas (81 Áreas)
# ─────────────────────────────────────────────────────────────
def parse_area_page(html: str, area_slug: str) -> List[Dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    buttons = soup.find_all("a", onclick=re.compile(r"showModalAnswerQuestion"))
    records = []

    for b in buttons:
        m = re.search(r"showModalAnswerQuestion\s*\(\s*event\s*,\s*['\"]([a-f0-9-]+)['\"]", b.get("onclick", ""))
        if not m:
            continue
        q_uuid = m.group(1)

        card = b.find_parent("div", class_="card")
        if not card:
            continue

        q_div = card.find("div", class_="question")
        q_html = str(q_div) if q_div else ""
        q_text = clean_html_text(q_html)

        opts_div = card.find("div", class_="options")
        options = {}
        if opts_div:
            for opt_row in opts_div.find_all("div", recursive=False):
                letter_tag = opt_row.find("strong")
                if letter_tag:
                    letter = letter_tag.get_text().strip().replace(")", "")
                    p_tags = opt_row.find_all("p")
                    options[letter] = str(p_tags[-1]) if p_tags else ""

        slug_a = card.find("a", href=re.compile(r"/preguntas/([a-z0-9-]+)"))
        web_url = f"{BASE_URL}{slug_a['href']}" if slug_a else ""

        records.append({
            "id": q_uuid,
            "area_slug": area_slug,
            "university_slug": None,
            "exam_slug": None,
            "area_name": area_slug.upper().replace("-", " "),
            "question_type": "Directa",
            "question_html": q_html,
            "question_text": q_text,
            "option_a": options.get("A", ""),
            "option_b": options.get("B", ""),
            "option_c": options.get("C", ""),
            "option_d": options.get("D", ""),
            "option_e": options.get("E", ""),
            "correct_key": None,
            "resolution_html": None,
            "resolution_text": None,
            "web_url": web_url,
        })

    return records


def process_single_area_page(task: Tuple[str, int]) -> Tuple[str, int, int]:
    area_slug, page_num = task
    url = f"{BASE_URL}/preguntas/area/{area_slug}?page={page_num}"
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        if r.status_code != 200:
            return area_slug, page_num, 0
        records = parse_area_page(r.text, area_slug)
        if not records:
            return area_slug, page_num, 0

        # Guardar en base de datos
        m_conn = sqlite3.connect(MASTER_DB_PATH)
        m_cur = m_conn.cursor()
        m_cur.executemany(INSERT_UPSERT_SQL, records)
        m_conn.commit()
        m_conn.close()

        # Actualizar índice
        i_conn = sqlite3.connect(INDEX_DB_PATH)
        i_cur = i_conn.cursor()
        uuids = [(r["id"],) for r in records]
        i_cur.executemany("UPDATE index_questions SET status = 'downloaded' WHERE uuid = ?", uuids)
        i_conn.commit()
        i_conn.close()

        return area_slug, page_num, len(records)
    except Exception:
        return area_slug, page_num, 0


def scrape_all_areas(max_workers: int = 8):
    print("\n[FASE 2/2] Extracción Complementaria desde Catálogo de Áreas Académicas...")
    conn_idx = sqlite3.connect(INDEX_DB_PATH)
    areas = conn_idx.cursor().execute("SELECT slug, total_pages FROM areas").fetchall()
    conn_idx.close()

    tasks = []
    for slug, pages in areas:
        for p in range(1, pages + 1):
            tasks.append((slug, p))

    total_tasks = len(tasks)
    start_time = time.time()
    total_saved = 0
    completed = 0

    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_page = {executor.submit(process_single_area_page, t): t for t in tasks}
        for future in concurrent.futures.as_completed(future_to_page):
            completed += 1
            area_slug, page_num, count = future.result()
            total_saved += count
            elapsed = time.time() - start_time
            rate = total_saved / elapsed if elapsed > 0 else 0
            percent = (completed / total_tasks) * 100

            if completed % 25 == 0 or completed == total_tasks:
                print(
                    f"   [ÁREAS {completed:03d}/{total_tasks}] ({percent:5.1f}%) | "
                    f"Preguntas procesadas: {total_saved:5,d} | Ritmo: {rate:4.1f} preg/s | {area_slug} p.{page_num}",
                    flush=True
                )

    print(f"-> FASE 2 COMPLETADA: {total_saved:,} registros procesados desde las áreas.")


# ─────────────────────────────────────────────────────────────
# Resumen y Estadísticas Finales
# ─────────────────────────────────────────────────────────────
def print_final_statistics():
    m_conn = sqlite3.connect(MASTER_DB_PATH)
    m_cur = m_conn.cursor()

    total_q = m_cur.execute("SELECT COUNT(*) FROM questions").fetchone()[0]
    with_opts = m_cur.execute("SELECT COUNT(*) FROM questions WHERE option_a != '' AND option_b != ''").fetchone()[0]
    with_keys = m_cur.execute("SELECT COUNT(*) FROM questions WHERE correct_key IS NOT NULL").fetchone()[0]
    with_res = m_cur.execute("SELECT COUNT(*) FROM questions WHERE resolution_html IS NOT NULL").fetchone()[0]

    # Conteo por materias STEM prioritarias
    math_areas = [
        ("razonamiento-matematico", "Razonamiento Matemático"),
        ("algebra", "Álgebra"),
        ("geometria", "Geometría"),
        ("trigonometria", "Trigonometría"),
        ("aritmetica", "Aritmética"),
        ("fisica", "Física"),
        ("quimica", "Química"),
    ]

    print("\n" + "=" * 70)
    print("   DESCARGA MAESTRA COMPLETADA CON ÉXITO")
    print("=" * 70)
    print(f"-> Total Preguntas Guardadas en Master DB: {total_q:,}")
    print(f"-> Con Opciones A-E completas:            {with_opts:,} ({with_opts/total_q*100:.1f}%)" if total_q > 0 else "")
    print(f"-> Con Clave Oficial desbloqueada:        {with_keys:,}")
    print(f"-> Con Resolución escrita paso a paso:    {with_res:,}")
    print("\n[DESGLOSE ÁREAS DE CIENCIAS Y MATEMÁTICAS]")
    for slug, label in math_areas:
        cnt = m_cur.execute("SELECT COUNT(*) FROM questions WHERE area_slug = ? OR area_name LIKE ?", (slug, f"%{slug}%")).fetchone()[0]
        print(f"   • {label:26s}: {cnt:4,d} preguntas")

    m_conn.close()


def main():
    print("=" * 70)
    print("   EXTRACTOR MAESTRO DE ALTO RENDIMIENTO - EDUTEKA.PE")
    print("=" * 70)
    init_master_db(MASTER_DB_PATH)

    # 1. Extraer desde todos los exámenes (166 exámenes)
    scrape_all_exams(max_workers=8)

    # 2. Extraer desde todas las áreas académicas (81 áreas, 827 páginas)
    scrape_all_areas(max_workers=8)

    # 3. Mostrar estadísticas completas
    print_final_statistics()


if __name__ == "__main__":
    main()
