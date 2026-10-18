"""
Paso 3: Exportador y Empaquetador del Banco de Preguntas Eduteka.pe
Organiza y exporta las 14,498 preguntas desde SQLite a estructuras JSON y Markdown limpias:
- dataset_eduteka/export/areas/<area_slug>.json
- dataset_eduteka/export/universidades/<university_slug>.json
- dataset_eduteka/export/summary.json
"""

import json
import sqlite3
from pathlib import Path

MASTER_DB = Path("dataset_eduteka") / "eduteka_master.db"
EXPORT_DIR = Path("dataset_eduteka") / "export"
AREAS_DIR = EXPORT_DIR / "areas"
UNIS_DIR = EXPORT_DIR / "universidades"


def export_dataset():
    print("=" * 65)
    print("   INICIANDO PASO 3: EXPORTACIÓN Y EMPAQUETADO DEL DATASET")
    print("=" * 65)

    AREAS_DIR.mkdir(parents=True, exist_ok=True)
    UNIS_DIR.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(MASTER_DB)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # 1. Total general
    total_q = cur.execute("SELECT COUNT(*) FROM questions").fetchone()[0]
    print(f"-> Base de datos maestra: {total_q:,} preguntas registradas.")

    # 2. Exportación por Área Académica
    areas = [r[0] for r in cur.execute("SELECT DISTINCT area_slug FROM questions WHERE area_slug IS NOT NULL").fetchall()]
    print(f"\n[1/2] Exportando {len(areas)} áreas académicas a JSON...")

    area_stats = {}
    for area in sorted(areas):
        rows = cur.execute("SELECT * FROM questions WHERE area_slug = ?", (area,)).fetchall()
        data = [dict(r) for r in rows]
        out_file = AREAS_DIR / f"{area}.json"
        out_file.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        area_stats[area] = len(data)

    print(f"-> {len(areas)} archivos generados en {AREAS_DIR.resolve()}")

    # 3. Exportación por Universidad
    unis = [r[0] for r in cur.execute("SELECT DISTINCT university_slug FROM questions WHERE university_slug IS NOT NULL").fetchall()]
    print(f"\n[2/2] Exportando {len(unis)} universidades a JSON...")

    uni_stats = {}
    for uni in sorted(unis):
        rows = cur.execute("SELECT * FROM questions WHERE university_slug = ?", (uni,)).fetchall()
        data = [dict(r) for r in rows]
        out_file = UNIS_DIR / f"{uni}.json"
        out_file.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        uni_stats[uni] = len(data)

    print(f"-> {len(unis)} archivos generados en {UNIS_DIR.resolve()}")

    # 4. Resumen global (summary.json)
    summary = {
        "total_questions": total_q,
        "database_file": "dataset_eduteka/eduteka_master.db",
        "total_areas": len(areas),
        "total_universities": len(unis),
        "questions_by_area": dict(sorted(area_stats.items(), key=lambda x: x[1], reverse=True)),
        "questions_by_university": dict(sorted(uni_stats.items(), key=lambda x: x[1], reverse=True)),
        "stem_math_total": sum(area_stats.get(k, 0) for k in [
            "razonamiento-matematico", "algebra", "geometria", "trigonometria",
            "aritmetica", "fisica", "quimica", "matematica"
        ])
    }

    summary_file = EXPORT_DIR / "summary.json"
    summary_file.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    print("\n" + "=" * 65)
    print("   EXPORTACIÓN COMPLETADA CON ÉXITO")
    print(f"Resumen global guardado en: {summary_file.resolve()}")
    print("=" * 65)
    conn.close()


if __name__ == "__main__":
    export_dataset()
