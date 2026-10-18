"""
Fase 4C: Generador de Fichas de Exámenes y Prácticas Imprimibles
Diseñado especialmente para profesores de matemáticas y ciencias preuniversitarias.

Genera material diagramado listo para imprimir en PDF o repartir a alumnos:
- Formato a 2 columnas tipo folleto preuniversitario (estilo UNI / San Marcos).
- Renderizado matemático de alta definición con KaTeX (fórmulas nítidas).
- Hoja de respuestas y claves al final.
- Selección por curso, universidad, dificultad y cantidad de preguntas.
"""

import argparse
import random
import sqlite3
from datetime import datetime
from pathlib import Path

MASTER_DB = Path("dataset_eduteka") / "eduteka_master.db"
OUTPUT_DIR = Path("dataset_eduteka") / "fichas_imprimibles"


HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>{title}</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"
        onload="renderMathInElement(document.body, {{
            delimiters: [
                {{left: '$$', right: '$$', display: true}},
                {{left: '\\[', right: '\\]', display: true}},
                {{left: '$', right: '$', display: false}},
                {{left: '\\(', right: '\\)', display: false}}
            ]
        }});"></script>
    <style>
        @page {{
            size: A4;
            margin: 15mm 15mm 15mm 15mm;
        }}
        body {{
            font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
            color: #111;
            line-height: 1.4;
            font-size: 13px;
            margin: 0;
            padding: 20px;
        }}
        .header {{
            border-bottom: 2px solid #003366;
            padding-bottom: 8px;
            margin-bottom: 16px;
        }}
        .header h1 {{
            font-size: 19px;
            margin: 0 0 4px 0;
            color: #003366;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        .meta-grid {{
            display: grid;
            grid-template-columns: 2fr 1fr 1fr;
            font-size: 12px;
            color: #444;
            margin-top: 6px;
        }}
        .columns {{
            column-count: 2;
            column-gap: 22px;
            column-rule: 1px solid #ddd;
        }}
        .question-item {{
            break-inside: avoid;
            margin-bottom: 18px;
            padding-bottom: 10px;
            border-bottom: 1px dashed #eee;
        }}
        .q-number {{
            font-weight: bold;
            color: #003366;
            margin-right: 4px;
        }}
        .q-badge {{
            display: inline-block;
            font-size: 10px;
            padding: 1px 6px;
            border-radius: 3px;
            background: #eef3f8;
            color: #003366;
            margin-left: 6px;
            text-transform: uppercase;
        }}
        .q-statement {{
            margin: 4px 0 8px 0;
        }}
        .q-options {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 4px 12px;
            font-size: 12px;
            margin-left: 6px;
        }}
        .opt-item strong {{
            color: #003366;
            margin-right: 4px;
        }}
        .page-break {{
            page-break-before: always;
            break-before: page;
        }}
        .answer-key-section {{
            margin-top: 30px;
            border: 2px solid #003366;
            border-radius: 6px;
            padding: 14px;
            background: #fafcff;
        }}
        .answer-grid {{
            display: grid;
            grid-template-columns: repeat(10, 1fr);
            gap: 8px;
            text-align: center;
            font-size: 12px;
            margin-top: 10px;
        }}
        .key-cell {{
            border: 1px solid #ccd8e6;
            padding: 4px;
            border-radius: 4px;
            background: #fff;
        }}
        .key-cell b {{
            display: block;
            color: #003366;
        }}
        @media print {{
            body {{ padding: 0; }}
            .no-print {{ display: none; }}
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>{title}</h1>
        <div class="meta-grid">
            <div><strong>Alumno(a):</strong> ________________________________________________</div>
            <div><strong>Fecha:</strong> {date}</div>
            <div><strong>Nivel:</strong> {difficulty}</div>
        </div>
        <div style="font-size: 11px; color: #666; margin-top: 4px;">
            <strong>Materia:</strong> {course} | <strong>Fuente:</strong> Banco Oficial de Exámenes de Admisión ({university})
        </div>
    </div>

    <div class="columns">
        {questions_html}
    </div>

    <div class="page-break answer-key-section">
        <h2 style="font-size: 15px; margin: 0 0 6px 0; color: #003366;">CUADRO DE CLAVES Y RESPUESTAS OFICIALES</h2>
        <p style="font-size: 11px; color: #666; margin: 0 0 10px 0;">Hoja de verificación para el docente / autocorrección.</p>
        <div class="answer-grid">
            {answers_html}
        </div>
    </div>
</body>
</html>
"""


def generate_exam(
    course: str = "algebra",
    university: str = "",
    difficulty: str = "",
    count: int = 20,
    title: str = "Práctica Calificada de Matemáticas",
) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(MASTER_DB)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    query = "SELECT * FROM questions WHERE 1=1"
    params = []

    if course and course != "all":
        query += " AND (area_slug = ? OR area_name LIKE ?)"
        params.extend([course, f"%{course}%"])

    if university and university != "all":
        query += " AND university_slug = ?"
        params.append(university)

    if difficulty and difficulty != "all":
        query += " AND difficulty_level = ?"
        params.append(difficulty)

    rows = cur.execute(query, params).fetchall()
    conn.close()

    if not rows:
        raise ValueError(f"No se encontraron preguntas con los filtros: curso={course}, uni={university}, dif={difficulty}")

    sample = random.sample(rows, min(count, len(rows)))

    q_items_html = []
    ans_cells_html = []

    for i, r in enumerate(sample, 1):
        # Opciones
        opts_html = []
        for let in ["A", "B", "C", "D", "E"]:
            val = r[f"option_{let.lower()}"]
            if val:
                opts_html.append(f'<div class="opt-item"><strong>{let})</strong> {val}</div>')

        badge = f'{r["university_slug"].upper() if r["university_slug"] else ""}'
        if r["difficulty_level"]:
            badge += f' • {r["difficulty_level"]}'

        item_str = f"""
        <div class="question-item">
            <div>
                <span class="q-number">{i}.</span>
                <span class="q-badge">{badge}</span>
            </div>
            <div class="q-statement">{r["question_html"]}</div>
            <div class="q-options">
                {''.join(opts_html)}
            </div>
        </div>
        """
        q_items_html.append(item_str)

        key_letter = r["correct_key"] or "—"
        ans_cells_html.append(f'<div class="key-cell"><b>{i}</b><span>{key_letter}</span></div>')

    now_str = datetime.now().strftime("%d/%m/%Y")
    full_html = HTML_TEMPLATE.format(
        title=title,
        date=now_str,
        difficulty=difficulty.capitalize() if difficulty else "Mixto",
        course=course.replace("-", " ").capitalize(),
        university=university.upper() if university else "Múltiples Universidades",
        questions_html="\n".join(q_items_html),
        answers_html="\n".join(ans_cells_html),
    )

    filename = f"ficha_{course}_{university or 'todas'}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
    out_file = OUTPUT_DIR / filename
    out_file.write_text(full_html, encoding="utf-8")
    return out_file


def main():
    parser = argparse.ArgumentParser(description="Fase 4C: Generador de Fichas de Exámenes Imprimibles")
    parser.add_argument("--course", type=str, default="algebra", help="Curso (ej: algebra, geometria, fisica, razonamiento-matematico)")
    parser.add_argument("--university", type=str, default="", help="Universidad (ej: uni, san-marcos, unt, unsa)")
    parser.add_argument("--difficulty", type=str, default="", help="Nivel (Básico, Intermedio, Avanzado)")
    parser.add_argument("--count", type=int, default=20, help="Número de preguntas (default: 20)")
    parser.add_argument("--title", type=str, default="Ficha de Evaluación Preuniversitaria", help="Título de la ficha")
    args = parser.parse_args()

    print("=" * 65)
    print("   GENERADOR DE FICHAS Y EXÁMENES IMPRIMIBLES (FASE 4C)")
    print("=" * 65)

    try:
        out = generate_exam(
            course=args.course,
            university=args.university,
            difficulty=args.difficulty,
            count=args.count,
            title=args.title,
        )
        print(f"\n[OK] ¡Ficha generada exitosamente en formato HTML / KaTeX listo para imprimir!")
        print(f"Archivo generado: {out.resolve()}")
        print("\nPuedes abrir este archivo en tu navegador y presionar Ctrl+P para imprimir o guardar como PDF.")
    except Exception as e:
        print(f"[ERROR] {e}")


if __name__ == "__main__":
    main()
