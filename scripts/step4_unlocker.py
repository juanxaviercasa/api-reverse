"""
Fase 4B: Desbloqueador y Enriquecedor de Claves y Solucionarios para Eduteka.pe
Diseñado para operar tanto con cuentas de estudiante como con cuentas de profesor.

Características:
- Detección de cuenta de profesor (EDUTEKA_TEACHER_COOKIE) o estudiante (EDUTEKA_COOKIE).
- Pacing seguro configurable (--delay 1.8s) para no exceder los límites de Express.
- Reintentos con lectura de cabecera 'Retry-After' ante cualquier pausa 429.
- Filtros por curso (--course), universidad (--university) o límite (--limit).
- Actualiza automáticamente dataset_eduteka/eduteka_master.db.
"""

import argparse
import json
import os
import re
import sqlite3
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional
import requests

BASE_URL = "https://eduteka.pe"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
MASTER_DB = Path("dataset_eduteka") / "eduteka_master.db"


def clean_html_text(html_content: Optional[str]) -> str:
    if not html_content:
        return ""
    text = re.sub(r"<[^>]+>", " ", html_content)
    return re.sub(r"\s+", " ", text).strip()


def get_cookie(cli_cookie: Optional[str] = None) -> Optional[str]:
    if cli_cookie:
        return cli_cookie

    teacher_cookie = os.environ.get("EDUTEKA_TEACHER_COOKIE")
    if teacher_cookie:
        return teacher_cookie

    cookie = os.environ.get("EDUTEKA_COOKIE")
    if cookie:
        return cookie

    env_path = Path(".env")
    if env_path.exists():
        text = env_path.read_text(encoding="utf-8")
        # Priorizar cookie de profesor si existe
        for line in text.splitlines():
            line = line.strip()
            if line.startswith("EDUTEKA_TEACHER_COOKIE="):
                val = line.split("=", 1)[1].strip().strip('"').strip("'")
                return val
        for line in text.splitlines():
            line = line.strip()
            if line.startswith("EDUTEKA_COOKIE="):
                val = line.split("=", 1)[1].strip().strip('"').strip("'")
                return val
    return None


def unlock_question(
    session: requests.Session,
    q_uuid: str,
    cookie: str,
    delay: float = 1.8,
    is_teacher: bool = False,
) -> Optional[Dict[str, Any]]:
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
        "X-Requested-With": "fetch",
        "Cookie": cookie,
    }

    # 1. Consultar detalle con la sesión autenticada
    detail_url = f"{BASE_URL}/preguntas/detail/{q_uuid}"
    try:
        res = session.get(detail_url, headers=headers, timeout=12)
        if res.status_code == 429:
            retry_after = int(res.headers.get("Retry-After", 60))
            print(f"\n[429 RATE-LIMIT] Pausa solicitada por el servidor. Esperando {retry_after}s...", flush=True)
            time.sleep(retry_after)
            return None

        if res.status_code != 200:
            return None

        data = res.json()
        if not data.get("status"):
            return None

    except Exception:
        return None

    q_raw = data.get("question", {})
    correct_key = None
    res_html = None

    # Caso 1: La cuenta ya tiene la respuesta visible directamente (ej. cuenta de profesor o respondida)
    if q_raw.get("rpta"):
        correct_key = q_raw.get("rpta")
        res_html = q_raw.get("resolution")
    elif q_raw.get("opts"):
        for o in q_raw.get("opts", []):
            if o.get("rpta") is True:
                correct_key = o.get("opt")
                break

    # Caso 2: Cuentas de estudiante -> enviar respuesta "A" para forzar revelación
    if not correct_key and not is_teacher:
        time.sleep(0.5)
        ans_url = f"{BASE_URL}/preguntas/{q_uuid}/enviar-respuesta"
        try:
            ans_res = session.post(ans_url, headers=headers, data={"rpta": "A"}, timeout=12)
            if ans_res.status_code == 429:
                retry_after = int(ans_res.headers.get("Retry-After", 60))
                print(f"\n[429 RATE-LIMIT] Esperando {retry_after}s...", flush=True)
                time.sleep(retry_after)
                return None

            if ans_res.status_code == 200:
                ans_data = ans_res.json()
                if ans_data.get("rpta"):
                    correct_key = ans_data.get("rpta")
                    res_html = ans_data.get("resolution")
                elif ans_data.get("message") == "Respondida anteriormente":
                    if ans_data.get("rpta"):
                        correct_key = ans_data.get("rpta")
                        res_html = ans_data.get("resolution")
        except Exception:
            pass

    time.sleep(delay)

    if correct_key or res_html:
        return {
            "id": q_uuid,
            "correct_key": correct_key,
            "resolution_html": res_html,
            "resolution_text": clean_html_text(res_html) if res_html else None,
        }

    return None


def run_unlocker():
    parser = argparse.ArgumentParser(description="Fase 4B: Desbloqueador de Claves y Solucionarios")
    parser.add_argument("--course", type=str, default="", help="Filtrar por slug de área (ej: algebra, fisica)")
    parser.add_argument("--university", type=str, default="", help="Filtrar por slug de universidad (ej: uni, san-marcos)")
    parser.add_argument("--limit", type=int, default=50, help="Límite de preguntas a desbloquear (default: 50)")
    parser.add_argument("--delay", type=float, default=1.8, help="Pausa entre peticiones en segundos (default: 1.8)")
    parser.add_argument("--cookie", type=str, default="", help="Cookie de sesión manual")
    args = parser.parse_args()

    print("=" * 70)
    print("   FASE 4B: DESBLOQUEADOR DE CLAVES Y SOLUCIONARIOS (EDUTEKA.PE)")
    print("=" * 70)

    cookie = get_cookie(args.cookie)
    if not cookie:
        print("[ERROR] No se encontró ninguna cookie de sesión (ni de profesor ni de estudiante).")
        print("Configura EDUTEKA_COOKIE o EDUTEKA_TEACHER_COOKIE en tu archivo .env.")
        sys.exit(1)

    is_teacher = False
    env_p = Path(".env")
    if env_p.exists() and "EDUTEKA_TEACHER_COOKIE=" in env_p.read_text(encoding="utf-8"):
        is_teacher = True
    if os.environ.get("EDUTEKA_TEACHER_COOKIE"):
        is_teacher = True

    print(f"[OK] Sesión cargada ({'Modo Profesor (Lectura Directa)' if is_teacher else 'Modo Estudiante'}).")

    conn = sqlite3.connect(MASTER_DB)
    cur = conn.cursor()

    query = "SELECT id, area_slug, university_slug, exam_slug, question_text FROM questions WHERE correct_key IS NULL"
    params = []
    if args.course:
        query += " AND (area_slug = ? OR area_name LIKE ?)"
        params.extend([args.course, f"%{args.course}%"])
    if args.university:
        query += " AND university_slug = ?"
        params.append(args.university)

    query += " ORDER BY CASE WHEN university_slug = 'uni' THEN 1 WHEN university_slug = 'san-marcos' THEN 2 ELSE 3 END"
    if args.limit > 0:
        query += f" LIMIT {args.limit}"

    cur.execute(query, params)
    pending = cur.fetchall()

    total_pending = len(pending)
    print(f"-> Preguntas seleccionadas para desbloquear: {total_pending:,}")
    if total_pending == 0:
        print("[OK] Todas las preguntas seleccionadas ya tienen clave registrada.")
        conn.close()
        return

    session = requests.Session()
    unlocked_keys = 0
    unlocked_resolutions = 0
    start_time = time.time()

    print(f"-> Iniciando desbloqueo con cadencia segura ({args.delay}s/pet)... Presiona Ctrl+C para pausar.\n")

    try:
        for idx, row in enumerate(pending, 1):
            q_id, a_slug, u_slug, e_slug, q_text = row
            result = unlock_question(session, q_id, cookie, delay=args.delay, is_teacher=is_teacher)

            if result:
                cur.execute(
                    """
                    UPDATE questions 
                    SET correct_key = COALESCE(?, correct_key),
                        resolution_html = COALESCE(?, resolution_html),
                        resolution_text = COALESCE(?, resolution_text)
                    WHERE id = ?
                    """,
                    (result["correct_key"], result["resolution_html"], result["resolution_text"], q_id),
                )
                if result.get("correct_key"):
                    unlocked_keys += 1
                if result.get("resolution_html"):
                    unlocked_resolutions += 1
                conn.commit()

                print(
                    f"[{idx:03d}/{total_pending:03d}] [OK] {q_id[:8]}... | Clave: {result.get('correct_key') or '-'} | "
                    f"Res: {'Sí' if result.get('resolution_html') else 'No'} | {(q_text or '')[:35]}...",
                    flush=True
                )
            else:
                print(f"[{idx:03d}/{total_pending:03d}] [SIN CLAVE] {q_id[:8]}... | No disponible en la web", flush=True)

    except KeyboardInterrupt:
        print("\n[PAUSA] Proceso detenido de forma segura.")
    finally:
        conn.commit()
        conn.close()

    elapsed = time.time() - start_time
    print("\n" + "=" * 70)
    print(f"Resumen: {unlocked_keys} claves desbloqueadas, {unlocked_resolutions} resoluciones en {elapsed:.1f}s.")
    print("=" * 70)


if __name__ == "__main__":
    run_unlocker()
