import requests
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path("scripts")))
from step2_bulk_downloader import load_cookie_from_env

cookie = load_cookie_from_env()
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
    'X-Requested-With': 'fetch',
    'Cookie': cookie
}

conn = sqlite3.connect('dataset_eduteka/eduteka_index.sqlite')
rows = conn.cursor().execute("SELECT uuid FROM index_questions WHERE status = 'error' LIMIT 3").fetchall()

for r in rows:
    uuid = r[0]
    print(f"Testing UUID: {uuid}")
    res = requests.get(f'https://eduteka.pe/preguntas/detail/{uuid}', headers=headers)
    print("Status code:", res.status_code)
    print("Response text:", res.text[:250])
    print("-" * 50)
