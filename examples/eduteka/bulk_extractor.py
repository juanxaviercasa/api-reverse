"""
Script de Extracción Masiva para Eduteka.pe
Descarga ejercicios con opciones, claves correctas y resoluciones paso a paso.
"""

import argparse
import json
import sys
from pathlib import Path

# Añadir ruta local para importar el cliente
sys.path.insert(0, str(Path(__file__).parent))
from eduteka_client import EdutekaClient


def main():
    parser = argparse.ArgumentParser(description="Extractor masivo de preguntas y resoluciones de Eduteka.pe")
    parser.add_argument("--area", default="razonamiento-matematico", help="Área académica a extraer (ej. algebra, geometria, razonamiento-matematico)")
    parser.add_argument("--pages", type=int, default=1, help="Número de páginas a descargar (20 preguntas por página)")
    parser.add_argument("--output", default="", help="Ruta del archivo de salida JSON")
    parser.add_argument("--no-solutions", action="store_true", help="No intentar desbloquear claves ni resoluciones")
    
    args = parser.parse_args()

    client = EdutekaClient()
    print("=" * 60)
    print("   EXTRACTOR DE BANCO DE PREGUNTAS Y RESOLUCIONES - EDUTEKA.PE")
    print("=" * 60)
    print(f"-> Área seleccionada: {args.area}")
    print(f"-> Páginas solicitadas: {args.pages} (aprox. {args.pages * 20} preguntas)")
    print(f"-> Autenticado: {'SÍ (desbloquea claves y resoluciones)' if client.is_authenticated else 'NO (sólo enunciados y opciones)'}")
    print("=" * 60)

    output_dir = Path("generated")
    output_dir.mkdir(parents=True, exist_ok=True)
    out_file = Path(args.output) if args.output else output_dir / f"eduteka_{args.area}_p{args.pages}.json"

    fetch_solutions = not args.no_solutions and client.is_authenticated

    total_extracted = []
    for page in range(1, args.pages + 1):
        print(f"\n[Página {page}/{args.pages}] Escaneando preguntas...")
        uuids = client.get_question_uuids(area=args.area, page=page)
        print(f"-> {len(uuids)} preguntas detectadas.")

        for i, uid in enumerate(uuids, 1):
            q = client.get_complete_question(uid, fetch_solution=fetch_solutions)
            if q:
                sol_info = f" [Clave: {q.correct_key}]" if q.correct_key else ""
                has_res = " (+Resolución)" if q.resolution_html else ""
                print(f"  ({i:02d}/{len(uuids):02d}) {q.question_text[:50]}...{sol_info}{has_res}")
                total_extracted.append(q.to_dict())

    # Guardar en archivo
    out_file.write_text(json.dumps(total_extracted, ensure_ascii=False, indent=2), encoding="utf-8")
    print("\n" + "=" * 60)
    print(f"[OK] EXTRACCION COMPLETADA: {len(total_extracted)} preguntas exportadas.")
    print(f"Archivo generado: {out_file.resolve()}")
    print("=" * 60)


if __name__ == "__main__":
    main()
