"""
Paso 2: Descargador Masivo y Resiliente de Eduteka.pe
Descarga todas las preguntas limpias con enunciados, opciones (A-E),
claves oficiales desbloqueadas y resoluciones paso a paso en LaTeX/KaTeX.

Características avanzadas:
- Control de ritmo (pacing respetuoso para no saturar al servidor).
- Detección y retroceso automático ante HTTP 429 (Too Many Requests).
- Desbloqueo automático de claves y resoluciones con sesión autenticada.
- Escritura atómica en SQLite WAL con reanudación instantánea ante interrupciones.
"""

import argparse
import json
import os
import queue
import re
import sqlite3
import sys
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
import requests

BASE_URL = "https://eduteka.pe"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

INDEX_DB_PATH = Path("dataset_eduteka") / "eduteka_index.sqlite"
MASTER_DB_PATH = Path("dataset_eduteka") / "eduteka_master.db"


class RateLimitController:
    """Controlador global de rate-limit para coordinar todos los hilos."""
    def __init__(self):
        self._lock = threading.Lock()
        self._blocked_until = 0.0

    def wait_if_needed(self):
        with self._lock:
            now = time.time()
            if now < self._blocked_until:
                wait_time = self._blocked_until - now
            else:
                wait_time = 0.0

        if wait_time > 0:
            print(f"\n[PAUSA ACTIVA] Esperando {wait_time:.1f}s restantes de enfriamiento...", flush=True)
            time.sleep(wait_time)

    def trigger_backoff(self, cooldown_seconds: float = 60.0):
        with self._lock:
            now = time.time()
            self._blocked_until = max(self._blocked_until, now + cooldown_seconds)
            print(f"\n[429 RATE-LIMIT] Servidor solicitó pausa. Bloqueando peticiones por {cooldown_seconds:.0f}s...", flush=True)


RATE_LIMITER = RateLimitController()


def load_cookie_from_env() -> Optional[str]:
    """Carga la cookie de sesión de Eduteka desde variables de entorno o archivo .env."""
    cookie = os.environ.get("EDUTEKA_COOKIE")
    if cookie:
        return cookie

    env_path = Path(".env")
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("EDUTEKA_COOKIE="):
                val = line.split("=", 1)[1].strip()
                if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                    val = val[1:-1]
                return val
    return None


def init_master_db(db_path: Path):
    """Inicializa la base de datos maestra con índices optimizados."""
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


def clean_html_text(html_content: Optional[str]) -> str:
    """Elimina etiquetas HTML conservando el texto plano y fórmulas."""
    if not html_content:
        return ""
    text = re.sub(r"<[^>]+>", " ", html_content)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def worker_fetch_question(
    session: requests.Session,
    q_uuid: str,
    meta: Dict[str, Any],
    cookie: Optional[str],
    max_retries: int = 4
) -> Optional[Dict[str, Any]]:
    """Descarga el detalle y la resolución de una pregunta con retroceso ante rate-limit."""
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
        "X-Requested-With": "fetch",
    }
    if cookie:
        headers["Cookie"] = cookie

    for attempt in range(max_retries):
        RATE_LIMITER.wait_if_needed()

        # 1. Obtener detalle de la pregunta
        detail_url = f"{BASE_URL}/preguntas/detail/{q_uuid}"
        try:
            res = session.get(detail_url, headers=headers, timeout=15)
            
            # Chequeo de rate-limiting (HTTP 429 o código en JSON)
            if res.status_code == 429 or "TOO_MANY_REQUESTS" in res.text:
                backoff_time = 60.0 * (attempt + 1)
                RATE_LIMITER.trigger_backoff(backoff_time)
                time.sleep(backoff_time)
                continue

            if res.status_code != 200:
                time.sleep(1.0)
                continue

            data = res.json()
            if not data.get("status"):
                # Si el mensaje dice "Algo sucedio", esperar breve y reintentar
                time.sleep(1.0)
                continue

        except Exception:
            time.sleep(1.5)
            continue

        q_raw = data.get("question", {})
        q_html = q_raw.get("question", "")
        q_text = clean_html_text(q_html)
        slug = q_raw.get("slug", "")
        opts = q_raw.get("options", {})

        correct_key = None
        res_html = None
        res_text = None

        # Verificar si la clave viene indicada en opts o rpta directa
        if q_raw.get("rpta"):
            correct_key = q_raw.get("rpta")
            res_html = q_raw.get("resolution")
        elif q_raw.get("opts"):
            for o in q_raw.get("opts", []):
                if o.get("rpta") is True:
                    correct_key = o.get("opt")
                    break

        # Si aún no tiene clave ni resolución y estamos autenticados, enviar respuesta para desbloquear
        if not correct_key and cookie:
            time.sleep(0.4)
            ans_url = f"{BASE_URL}/preguntas/{q_uuid}/enviar-respuesta"
            try:
                ans_res = session.post(ans_url, headers=headers, data={"rpta": "A"}, timeout=15)
                
                if ans_res.status_code == 429 or "TOO_MANY_REQUESTS" in ans_res.text:
                    RATE_LIMITER.trigger_backoff(60.0)
                    time.sleep(60.0)
                elif ans_res.status_code == 200:
                    ans_data = ans_res.json()
                    if ans_data.get("status") and ans_data.get("rpta"):
                        correct_key = ans_data.get("rpta")
                        res_html = ans_data.get("resolution")
                    elif ans_data.get("message") == "Respondida anteriormente":
                        # Ya estaba respondida; si no vino en el primer get, re-consultar
                        if ans_data.get("rpta"):
                            correct_key = ans_data.get("rpta")
                            res_html = ans_data.get("resolution")
            except Exception:
                pass

        if res_html:
            res_text = clean_html_text(res_html)

        return {
            "id": q_uuid,
            "area_slug": meta.get("area_slug"),
            "university_slug": meta.get("university_slug"),
            "exam_slug": meta.get("exam_slug"),
            "area_name": q_raw.get("area", ""),
            "question_type": q_raw.get("type", "Directa"),
            "question_html": q_html,
            "question_text": q_text,
            "option_a": opts.get("A", ""),
            "option_b": opts.get("B", ""),
            "option_c": opts.get("C", ""),
            "option_d": opts.get("D", ""),
            "option_e": opts.get("E", ""),
            "correct_key": correct_key,
            "resolution_html": res_html,
            "resolution_text": res_text,
            "web_url": f"{BASE_URL}/preguntas/{slug}" if slug else "",
        }

    return None


def downloader_worker(
    work_queue: queue.Queue,
    result_queue: queue.Queue,
    cookie: Optional[str],
    delay: float,
    stop_event: threading.Event,
):
    session = requests.Session()
    while not stop_event.is_set():
        try:
            item = work_queue.get(timeout=1.0)
        except queue.Empty:
            continue

        q_uuid, meta = item
        record = worker_fetch_question(session, q_uuid, meta, cookie)
        result_queue.put((q_uuid, record))
        work_queue.task_done()
        time.sleep(delay)


def db_writer_thread(
    result_queue: queue.Queue,
    stop_event: threading.Event,
    total_to_process: int,
):
    master_conn = sqlite3.connect(MASTER_DB_PATH)
    master_cur = master_conn.cursor()

    index_conn = sqlite3.connect(INDEX_DB_PATH)
    index_cur = index_conn.cursor()

    saved_count = 0
    keys_count = 0
    res_count = 0
    error_count = 0
    start_time = time.time()
    last_log_time = time.time()

    insert_sql = """
    INSERT OR REPLACE INTO questions (
        id, area_slug, university_slug, exam_slug, area_name, question_type,
        question_html, question_text, option_a, option_b, option_c, option_d,
        option_e, correct_key, resolution_html, resolution_text, web_url
    ) VALUES (
        :id, :area_slug, :university_slug, :exam_slug, :area_name, :question_type,
        :question_html, :question_text, :option_a, :option_b, :option_c, :option_d,
        :option_e, :correct_key, :resolution_html, :resolution_text, :web_url
    )
    """

    while not stop_event.is_set() or not result_queue.empty():
        try:
            item = result_queue.get(timeout=1.0)
        except queue.Empty:
            continue

        q_uuid, record = item
        if record:
            master_cur.execute(insert_sql, record)
            index_cur.execute("UPDATE index_questions SET status = 'downloaded' WHERE uuid = ?", (q_uuid,))
            saved_count += 1
            if record.get("correct_key"):
                keys_count += 1
            if record.get("resolution_html"):
                res_count += 1
        else:
            index_cur.execute("UPDATE index_questions SET status = 'error' WHERE uuid = ?", (q_uuid,))
            error_count += 1

        result_queue.task_done()

        # Commit periódico cada 10 preguntas o cada 8 segundos
        now = time.time()
        if (saved_count + error_count) % 10 == 0 or (now - last_log_time) >= 8.0:
            master_conn.commit()
            index_conn.commit()
            elapsed = now - start_time
            processed = saved_count + error_count
            rate = processed / elapsed if elapsed > 0 else 0
            eta_mins = (total_to_process - processed) / (rate * 60) if rate > 0 else 0
            percent = (processed / total_to_process * 100) if total_to_process > 0 else 0

            print(
                f"[{datetime.now().strftime('%H:%M:%S')}] Avance: {processed:,}/{total_to_process:,} "
                f"({percent:.1f}%) | Guardadas: {saved_count:,} (Claves: {keys_count}, Res: {res_count}) "
                f"| Errores: {error_count} | Ritmo: {rate:.2f} p/s | ETA: {eta_mins:.1f} min",
                flush=True
            )
            last_log_time = now

    master_conn.commit()
    index_conn.commit()
    master_conn.close()
    index_conn.close()


def main():
    parser = argparse.ArgumentParser(description="Paso 2: Descargador Masivo de Eduteka.pe")
    parser.add_argument("--workers", type=int, default=2, help="Número de hilos concurrentes (default: 2)")
    parser.add_argument("--delay", type=float, default=0.8, help="Pausa entre peticiones en segundos (default: 0.8)")
    parser.add_argument("--limit", type=int, default=0, help="Límite de preguntas a descargar (0 = todas)")
    args = parser.parse_args()

    print("=" * 70)
    print("   DESCARGADOR MASIVO RESILIENTE DE EDUTEKA.PE (PASO 2)")
    print("=" * 70)

    cookie = load_cookie_from_env()
    if not cookie:
        print("[AVISO] No se encontró EDUTEKA_COOKIE en .env; las claves y resoluciones no se desbloquearán.")
    else:
        print("[OK] Sesión autenticada cargada correctamente. Se extraerán claves y resoluciones oficiales.")

    init_master_db(MASTER_DB_PATH)

    # Leer preguntas pendientes
    index_conn = sqlite3.connect(INDEX_DB_PATH)
    index_cur = index_conn.cursor()
    
    query = "SELECT uuid, area_slug, university_slug, exam_slug FROM index_questions WHERE status = 'pending'"
    if args.limit > 0:
        query += f" LIMIT {args.limit}"
    
    index_cur.execute(query)
    pending_rows = index_cur.fetchall()
    index_conn.close()

    total_pending = len(pending_rows)
    print(f"-> Total preguntas pendientes a procesar en esta sesión: {total_pending:,}")

    if total_pending == 0:
        print("[OK] ¡Todas las preguntas ya están descargadas en eduteka_master.db!")
        return

    work_queue = queue.Queue(maxsize=1000)
    result_queue = queue.Queue()
    stop_event = threading.Event()

    # Iniciar hilo escritor de base de datos
    writer_thread = threading.Thread(
        target=db_writer_thread,
        args=(result_queue, stop_event, total_pending),
        daemon=True,
    )
    writer_thread.start()

    # Iniciar trabajadores de descarga
    threads = []
    for _ in range(args.workers):
        t = threading.Thread(
            target=downloader_worker,
            args=(work_queue, result_queue, cookie, args.delay, stop_event),
            daemon=True,
        )
        t.start()
        threads.append(t)

    print(f"-> Trabajadores activos: {args.workers} | Pausa: {args.delay}s/pet | Auto-Backoff: Activado")
    print("-> Guardando continuamente en dataset_eduteka/eduteka_master.db\n")

    try:
        for row in pending_rows:
            q_uuid, area_slug, uni_slug, exam_slug = row
            meta = {
                "area_slug": area_slug,
                "university_slug": uni_slug,
                "exam_slug": exam_slug,
            }
            work_queue.put((q_uuid, meta))

        work_queue.join()
        stop_event.set()
        writer_thread.join()

    except KeyboardInterrupt:
        print("\n[PAUSA] Guardando progreso de forma segura...")
        stop_event.set()
        writer_thread.join()
        print("[CHECKPOINT GUARDADO] Puedes reanudar en cualquier momento ejecutando el comando.")
        sys.exit(0)

    print("\n" + "=" * 70)
    print("   DESCARGA COMPLETADA CON ÉXITO")
    print(f"Base de datos maestra en: {MASTER_DB_PATH.resolve()}")
    print("=" * 70)


if __name__ == "__main__":
    main()
