# Extraer una vez, reutilizar en varios proyectos

El Studio conserva el motor de captura y generación de clientes. Los perfiles orientan el objetivo hacia matemáticas, ciencias, desarrollo, diseño o marketing/ventas. No garantizan compatibilidad con un sitio concreto.

## Probar sin modelo ni navegador

Desde la raíz del repositorio, después de instalar el proyecto:

```powershell
uv run python -m reverse_api.knowledge normalize examples/knowledge/response.json --source-url https://example.org/math-fixture --profile mathematics --output generated/demo-mathematics
```

El ejemplo es contenido de prueba propio; no representa datos descargados de example.org. Cada ejecución requiere una carpeta de salida nueva o vacía para evitar sobrescribir versiones anteriores.

## Exportar una captura existente

```powershell
uv run python -m reverse_api.knowledge har captura.har --profile mathematics --output generated/algebra-v1
```

Se procesan respuestas HTTP satisfactorias con MIME JSON y cuerpo embebido, incluido base64. HTML, PDF, cuerpos externos y respuestas no JSON quedan fuera. El archivo HAR completo nunca se copia al paquete de datos.

## Qué recibes

- `raw/response-*.json`: respuestas observadas con saneamiento de secretos comunes. No son copias forenses byte por byte.
- `normalized/items.json`: registros con `id`, `source_url`, `captured_at`, `content_hash`, `raw_file`, `json_pointer`, `profile`, `license`, `observed` e `inferred`.
- `manifest.json`: versión del formato, fuentes y archivos del paquete.
- `quality-report.json`: registros, respuestas omitidas, duplicados y límites de cobertura.

Los arrays raíz se convierten en registros individuales; los objetos anidados permanecen intactos. Por ejemplo, una respuesta `{ "items": [...], "next_page": 2 }` se conserva completa: mapear `items` como ejercicios requiere conocer el contrato de esa fuente. No se adivina una estructura semántica.

## Llevar los JSON a una IA

Utiliza `observed` como evidencia y conserva sus identificadores y procedencia. Una instrucción útil:

> Mapea estos registros a mi contrato de contenido educativo. Conserva id, source_url y content_hash. No inventes respuestas ni soluciones: usa null cuando falten. Guarda tema o dificultad estimados en inferred, con método y estado de revisión. Conserva literalmente fórmulas y referencias a imágenes. Explica campos que no puedas mapear y devuelve el JSON junto con un reporte de incidencias.

La clasificación y el mapeo con IA son una etapa posterior; esta entrega no los ejecuta. El perfil no prueba que todos los registros capturados sean relevantes. Revisar una muestra frente a la fuente antes de alimentar un evaluador de exámenes.

## Ejecución desde el Studio

1. Instala estos cambios en la rama de tu repositorio que ejecutarás.
2. Configura `ANTHROPIC_API_KEY` como secreto de Actions. El workflow actual elige Claude; los demás proveedores siguen disponibles desde la CLI.
3. Introduce URL, objetivo acotado, perfil y lenguaje. Para empezar, utiliza una fuente propia o una API pública adecuada para tu uso.
4. Introduce un token temporal con Actions de lectura/escritura para ese repositorio. Se conserva únicamente en memoria; la interfaz elimina el token guardado por la versión anterior.
5. La interfaz sigue la ejecución por un identificador único y enlaza el artefacto real. GitHub debe tener el workflow disponible en su rama predeterminada para aceptar el despacho.

No se promete extracción completa, paginación completa o resolución de autenticación de todos los sitios. Detener el seguimiento no cancela el runner; puedes cancelarlo desde GitHub. Una recarga pierde el seguimiento y el token, pero las ejecuciones permanecen en Actions.

El workflow ejecuta el checkout y dependencias bloqueadas, aplica el lenguaje seleccionado, conserva fallos como fallos y sube sólo el paquete de datos. No hace commits automáticos. Los clientes y el HAR se mantienen fuera de los artefactos remotos mientras no exista revisión independiente de secretos del código generado; la CLI local sigue produciendo clientes.

## Límites de seguridad y operación

El saneamiento identifica campos de secretos comunes y algunos patrones; no garantiza anonimización ni eliminación de todos los secretos. Elimina query y fragmento de URLs exportadas, por lo que parámetros de procedencia no se conservan. Revisa manualmente antes de compartir datos.

La validación de URL rechaza protocolos inválidos, credenciales y direcciones IP privadas literales; no sustituye un firewall que controle DNS y redirecciones. El agente conserva el sistema de permisos amplio del motor heredado y puede ejecutar herramientas: esta etapa es para trabajos personales supervisados, no un servicio público multiusuario. Quedan pendientes aislamiento estricto, saneamiento previo al modelo y límites de costo por ejecución.

No se descargan imágenes enlazadas ni se realiza clasificación automática. Tampoco se implementaron checkpoints de paginación, sincronización incremental o una cola multiusuario. El hash y el manifiesto permiten preparar esas mejoras sin perder trazabilidad.

La consulta directa de JSON en el navegador conserva la respuesta sin saneamiento y depende de CORS de la fuente. El motor de captura ofrece la alternativa para integraciones que no permiten lectura desde el navegador.
