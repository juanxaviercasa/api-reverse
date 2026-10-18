"""
Script de demostración para Eduteka.pe
Descarga ejercicios de Razonamiento Matemático con fórmulas LaTeX
y los formatea en un dataset listo para usar en aplicaciones web o exámenes.
"""

from eduteka_client import EdutekaClient
import json

def main():
    print("Iniciando cliente API de Eduteka...")
    client = EdutekaClient()

    # 1. Obtener preguntas de la página 1 de Razonamiento Matemático
    print("Consultando página 1 de Razonamiento Matemático...")
    uuids = client.get_question_uuids("razonamiento-matematico", page=1)
    print(f"-> Se encontraron {len(uuids)} preguntas en esta página.\n")

    # 2. Descargar el detalle estructurado de las primeras 5 preguntas
    extracted = []
    for i, uid in enumerate(uuids[:5], 1):
        q = client.get_question_detail(uid)
        if q:
            print(f"[{i}] {q.area} - ID: {q.id}")
            print(f"    Pregunta: {q.clean_text}")
            print(f"    Opciones: {q.options}")
            print(f"    URL Web:  {q.web_url}")
            print("-" * 50)
            extracted.append({
                "id": q.id,
                "area": q.area,
                "pregunta_html": q.question_html,
                "pregunta_texto": q.clean_text,
                "opciones": q.options,
                "url": q.web_url
            })

    # 3. Guardar en JSON
    output_path = "eduteka_matematicas_export.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(extracted, f, ensure_ascii=False, indent=2)
    print(f"\n¡Listo! Datos guardados en {output_path}")

if __name__ == "__main__":
    main()
