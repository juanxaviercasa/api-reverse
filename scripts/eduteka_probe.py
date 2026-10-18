import requests
import re
import json

headers = {
    'Accept': 'application/json',
    'X-Requested-With': 'fetch',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
}

def probe_eduteka():
    print("=== Conectando con https://eduteka.pe/ ===")
    
    # 1. Obtener lista de preguntas en Razonamiento Matemático
    url_list = "https://eduteka.pe/preguntas/area/razonamiento-matematico?page=1"
    resp = requests.get(url_list, headers={'User-Agent': headers['User-Agent']})
    
    if resp.status_code != 200:
        print(f"Error al acceder a {url_list}: {resp.status_code}")
        return
        
    pattern = r"showModalAnswerQuestion\s*\(\s*event\s*,\s*['\"]([a-f0-9-]+)['\"]\s*\)"
    uuids = re.findall(pattern, resp.text)
    print(f"-> Identificadas {len(uuids)} preguntas en la página 1 de Razonamiento Matemático.\n")
    
    # 2. Consultar el endpoint interno /preguntas/detail/{uuid}
    extracted = []
    for i, uid in enumerate(uuids[:3], 1):
        detail_url = f"https://eduteka.pe/preguntas/detail/{uid}"
        res = requests.get(detail_url, headers=headers)
        if res.status_code == 200:
            data = res.json()
            if data.get("status"):
                q = data["question"]
                print(f"--- Pregunta {i} (ID: {uid}) ---")
                print(f"Área: {q.get('area')}")
                print(f"Enunciado: {q.get('question')}")
                print(f"Opciones: {q.get('options')}")
                print(f"Enlace Web: https://eduteka.pe/preguntas/{q.get('slug')}")
                print()
                extracted.append(q)
                
    # 3. Guardar muestra local en JSON
    with open("examples/knowledge/eduteka_sample.json", "w", encoding="utf-8") as f:
        json.dump(extracted, f, ensure_ascii=False, indent=2)
    print("-> Muestra guardada exitosamente en examples/knowledge/eduteka_sample.json")

if __name__ == "__main__":
    probe_eduteka()
