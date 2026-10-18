"""
Descargador Masivo de Imágenes de Preguntas (Eduteka.pe)
Descarga todas las imágenes (diagramas de física, figuras geométricas, fórmulas gráficas)
para que el banco de preguntas funcione 100% offline y de forma autónoma.
"""

import concurrent.futures
import os
import re
import sqlite3
import sys
import time
from pathlib import Path
from typing import Set, Tuple
from urllib.parse import urlparse
import requests

BASE_URL = "https://eduteka.pe"
MASTER_DB = Path("dataset_eduteka") / "eduteka_master.db"
LOCAL_IMAGES_DIR = Path("dataset_eduteka") / "images"
WEB_IMAGES_DIR = Path("website") / "public" / "images" / "questions"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
}


def extract_all_image_urls() -> Set[str]:
    conn = sqlite3.connect(MASTER_DB)
    cur = conn.cursor()
    rows = cur.execute("SELECT question_html, option_a, option_b, option_c, option_d, option_e, resolution_html FROM questions").fetchall()
    conn.close()

    image_urls = set()
    img_pattern = r'<img[^>]+src=[\'"]([^\'"]+)[\'"]'

    for row in rows:
        for field in row:
            if field and "<img" in field:
                found = re.findall(img_pattern, field)
                for u in found:
                    image_urls.add(u.strip())

    return image_urls


def download_single_image(url_path: str) -> Tuple[str, bool, int]:
    # Normalizar URL
    if url_path.startswith("http://") or url_path.startswith("https://"):
        full_url = url_path
        filename = Path(urlparse(url_path).path).name
    elif url_path.startswith("/"):
        full_url = f"{BASE_URL}{url_path}"
        filename = Path(url_path).name
    else:
        full_url = f"{BASE_URL}/{url_path}"
        filename = Path(url_path).name

    if not filename:
        return url_path, False, 0

    dest_dataset = LOCAL_IMAGES_DIR / filename
    dest_web = WEB_IMAGES_DIR / filename

    # Si ya existe en ambos y tiene tamaño > 0, saltar
    if dest_dataset.exists() and dest_web.exists() and dest_dataset.stat().st_size > 0:
        return url_path, True, dest_dataset.stat().st_size

    try:
        res = requests.get(full_url, headers=HEADERS, timeout=12)
        if res.status_code == 200 and len(res.content) > 0:
            dest_dataset.write_bytes(res.content)
            dest_web.write_bytes(res.content)
            return url_path, True, len(res.content)
        return url_path, False, 0
    except Exception:
        return url_path, False, 0


def update_database_image_paths():
    print("\n[ACTUALIZACIÓN] Normalizando rutas de imágenes en la base de datos...")
    conn = sqlite3.connect(MASTER_DB)
    cur = conn.cursor()

    # Reemplazar URLs absolutas por relativas /images/questions/...
    fields = [
        "question_html", "option_a", "option_b", "option_c",
        "option_d", "option_e", "resolution_html"
    ]
    for f in fields:
        cur.execute(f"""
        UPDATE questions 
        SET {f} = REPLACE({f}, 'https://eduteka.pe/images/questions/', '/images/questions/')
        WHERE {f} LIKE '%https://eduteka.pe/images/questions/%'
        """)
        cur.execute(f"""
        UPDATE questions 
        SET {f} = REPLACE({f}, 'http://eduteka.pe/images/questions/', '/images/questions/')
        WHERE {f} LIKE '%http://eduteka.pe/images/questions/%'
        """)

    conn.commit()
    conn.close()
    print("-> Base de datos actualizada con rutas locales.")


def main():
    print("=" * 70)
    print("   DESCARGADOR MASIVO DE IMÁGENES EDUCATIVAS (EDUTEKA.PE)")
    print("=" * 70)

    LOCAL_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    WEB_IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    urls = extract_all_image_urls()
    total_imgs = len(urls)
    print(f"-> Total imágenes únicas identificadas en el banco: {total_imgs:,}")

    if total_imgs == 0:
        print("[OK] No se encontraron imágenes pendientes.")
        return

    print("-> Iniciando descarga paralela con 16 trabajadores...")
    start_time = time.time()
    success_count = 0
    total_bytes = 0
    completed = 0

    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as executor:
        future_to_url = {executor.submit(download_single_image, u): u for u in urls}
        for future in concurrent.futures.as_completed(future_to_url):
            completed += 1
            u, ok, size = future.result()
            if ok:
                success_count += 1
                total_bytes += size

            if completed % 100 == 0 or completed == total_imgs:
                percent = (completed / total_imgs) * 100
                elapsed = time.time() - start_time
                rate = completed / elapsed if elapsed > 0 else 0
                mb = total_bytes / (1024 * 1024)
                print(
                    f"   [{completed:04d}/{total_imgs:04d}] ({percent:5.1f}%) | "
                    f"Descargadas: {success_count:4d} | Tamaño: {mb:5.1f} MB | Ritmo: {rate:4.1f} img/s",
                    flush=True
                )

    elapsed = time.time() - start_time
    total_mb = total_bytes / (1024 * 1024)
    print("\n" + "=" * 70)
    print(f"DESCARGA DE IMÁGENES FINALIZADA: {success_count:,}/{total_imgs:,} imágenes ({total_mb:.1f} MB) en {elapsed:.1f}s.")
    print(f"Carpeta web local:     {WEB_IMAGES_DIR.resolve()}")
    print(f"Carpeta archivo local: {LOCAL_IMAGES_DIR.resolve()}")
    print("=" * 70)

    # Actualizar DB y exportaciones
    update_database_image_paths()


if __name__ == "__main__":
    main()
