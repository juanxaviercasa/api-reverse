# Auditoría técnica y propuesta de evolución

Fecha: 18 de octubre de 2026. Base revisada: commit `2e43bc9`, versión Python 0.14.0. Remotos: fork `juanxaviercasa/api-reverse` y upstream `kalil0321/reverse-api-engineer`. El árbol estaba limpio al comenzar.

## Estado tras la primera remodelación

Las secciones de hallazgos describen la base auditada, anterior a los cambios. Se implementó una primera etapa orientada a extracción educativa, manteniendo modos y lenguajes del motor. El flujo y sus límites están documentados en [examples/knowledge/README.md](examples/knowledge/README.md).

- Studio con seis perfiles: matemáticas, ciencias, desarrollo, diseño, marketing/ventas y general; consulta directa de JSON y cálculo Newton sin respaldo ficticio.
- Seguimiento por identificador del workflow, estados terminales, enlace al artefacto real, token sólo en memoria y eliminación del PAT heredado.
- Workflow que instala el checkout bloqueado, transmite inputs por entorno y aplica lenguaje/perfil; sin push automático ni permiso de escritura Git. Publica datos sólo tras éxito y rechaza archivos de entrega introducidos durante la captura.
- Exportador local de JSON/HAR con datos observados, procedencia, punteros, hashes, deduplicación y redacción básica. Esquema versionado en `schemas/knowledge-record.schema.json`.
- Instrucciones de generación corregidas para no incrustar credenciales. Configuración con raíz JSON no válida recupera valores por defecto.
- CI del sitio incorpora lint, tipos y regresión funcional del Studio. Scripts de build/dev usan webpack, que compiló correctamente en este entorno donde Turbopack falla al procesar CSS.

Validación realizada: suite Python completa con **1052 pruebas aprobadas y 3 omitidas**, usando Python 3.12.14, intérprete fijado para los subprocesos uv y directorio personal simulado dentro del proyecto. Después de añadir defensas de entrega/HAR, **56 pruebas específicas aprobadas**. Ruff, ESLint, TypeScript y mypy con plataforma Linux pasaron. Mypy nativo en Windows detecta dos ramas marcadas como inalcanzables en archivos heredados sin cambios. El build de producción con webpack pasó. Chrome verificó despacho simulado, perfil/lenguaje, descarga, errores, borrado de token, consulta/descarga directa JSON y vista móvil. Hubo avisos de coroutines no esperadas en mocks de pruebas existentes. No se lanzó un trabajo real de IA ni un despliegue.

Pendientes explícitos: aislamiento estricto del agente y saneamiento previo al modelo; escaneo independiente de clientes generados antes de publicarlos; validación tipada completa de configuración y concurrencia del historial; clasificación semántica con IA, descarga de imágenes, conectores verificados por fuente, checkpoints/paginación y sincronización incremental. El exportador inicial conserva contenedores anidados y no afirma haber convertido cada respuesta en ejercicios individuales. Los clientes siguen disponibles en la CLI local; el paquete remoto entrega sólo datos, hasta contar con revisión de secretos del código.

## 1. Dictamen

El proyecto ofrece un motor útil para descubrir llamadas HTTP a partir de navegación y generar clientes. El nuevo estudio matemático es un prototipo: activa un workflow, pero no recupera su resultado y muestra código de ejemplo; el respaldo de cálculo produce respuestas fijas. No está listo para utilizar sus resultados en clases o como servicio para otros usuarios sin corregir estos puntos.

La dirección acordada es conservar las capacidades generales del motor y especializar la extracción y exportación de conocimiento para enseñanza y aprendizaje de matemáticas y ciencias. El entregable principal es un conjunto de datos reutilizable, junto con el conector que permite actualizarlo. Evaluadores de exámenes, generadores de problemas y sitios educativos son proyectos consumidores de esos datos. Python y TypeScript pueden ser los primeros lenguajes del piloto sin eliminar los demás lenguajes ni modos existentes. Desarrollo, diseño y marketing podrán incorporarse mediante perfiles adicionales.

Este documento distingue defectos observados, riesgos de diseño y propuestas. Ninguna auditoría por inspección garantiza encontrar todos los errores. No se comprobaron secretos, configuración remota, facturación ni ejecuciones reales de GitHub Actions o proveedores de IA.

## 2. Alcance y evidencias de validación

Se revisaron estructura, README, manifiestos, workflows, configuración, almacenamiento de sesiones, sincronización, permisos de agentes, captura HAR, CLI y el componente del estudio. Se comparó el último commit con su base: ocho archivos cambiados; la nueva interfaz concentra 763 líneas. Se examinaron rutas y pruebas existentes; no se hizo revisión exhaustiva línea por línea de cada backend y ejemplo.

Comprobaciones locales:

| Comprobación | Resultado |
|---|---|
| Git al inicio | Sin cambios locales |
| TypeScript: `node node_modules/typescript/bin/tsc --noEmit --incremental false`, en `website` | Pasó, código 0 |
| ESLint sobre `math-studio.tsx` y `studio/page.tsx` | Falló, código 1: `react-hooks/set-state-in-effect` en `math-studio.tsx:185` |
| Parseo AST de `src/**/*.py` y `tests/**/*.py`, con Python 3.12.14 | Pasaron 63 archivos; comprueba sintaxis, no ejecución |
| ConfigManager con archivo temporal que contiene `[]` | Falló: `AttributeError: 'list' object has no attribute 'get'` |
| `uv run --offline --no-sync pytest -q` | No ejecutó pruebas: falta el intérprete Python 3.13 solicitado por el proyecto |

El Python 3.12 incluido en el entorno no tiene pytest, ruff, mypy ni las dependencias del proyecto. No se descargaron dependencias ni se hicieron llamadas pagadas. El resultado de TypeScript no verifica exactitud matemática ni integración con GitHub.

## 3. Fortalezas que conviene conservar

- Separación del motor en `BaseEngineer` y adaptadores para proveedores; evita rehacer captura y generación.
- CLI con salida JSON/NDJSON, códigos de salida e historial: buena base para automatizar desde otros proyectos.
- Extras opcionales para captura manual y collector; lockfile Python y del sitio.
- CI Python con lint, tipos y matriz de tres versiones y tres sistemas operativos.
- Validación de componentes de rutas y contención en `utils.py`; escritura atómica del historial en `session.py`.
- Pruebas de compatibilidad con Windows y de ejecución por lenguaje; existen pruebas reales de navegadores para documentación y cabecera.
- Remoto upstream configurado y licencia MIT del proyecto base. Mantener atribuciones al reutilizar código.

## 4. Hallazgos priorizados

P0: corregir antes de habilitar generación remota con secretos. P1: bloquea confianza o funcionamiento. P2: mantenimiento y operación. La prioridad expresa impacto, no demuestra explotación remota anónima.

### H01 — P0: interpolación de entradas en shell

**Evidencia:** `.github/workflows/reverse-api-backend.yml:69`, `:87`, `:91`, `:92`, `:113`, `:121` y `:122` insertan expresiones de inputs directamente en scripts Bash. Comillas dobles no neutralizan sustitución de comandos que ya forma parte del script generado. `run_id` también interviene en rutas sin validación propia del workflow.

**Impacto:** una entrada manipulada de alguien con capacidad de despacho puede ejecutar comandos en el runner. El paso del motor recibe claves de proveedores, y checkout conserva por defecto credenciales con permiso de escritura. No se probó un ataque ni se afirma acceso anónimo al workflow.

**Arreglo:** pasar inputs mediante `env`, tratarlos como datos entrecomillados, validar longitud/esquema de URL e identificador; usar `contents: read`, `persist-credentials: false` y publicar artefactos en lugar de hacer push directo.

**Aceptación:** entradas con caracteres especiales conservan su valor literal y nunca crean archivos o comandos adicionales; identificadores con separadores de rutas son rechazados.

### H02 — P1: se ejecuta el paquete publicado, no el código del fork

**Evidencia:** workflow `:63`: `uv tool install "reverse-api-engineer[manual]"` sin versión; el checkout no se instala.

**Impacto:** arreglar el repositorio puede no modificar el comportamiento de la generación remota; dependencias y versión quedan fuera del lockfile local.

**Arreglo:** instalar el checkout con `uv sync --locked --extra manual` y ejecutar con `uv run --no-sync`. Registrar commit y versiones en el resultado. Instalar el navegador desde el mismo entorno de ejecución.

**Aceptación:** una modificación de prueba del motor se observa en el runner y el manifiesto identifica el commit exacto.

### H03 — P1: directorio de salida desconectado del motor

**Evidencia:** workflow `:81` define `RAE_OUTPUT_DIR`, pero no se encontró lectura de esa variable en `src`. La CLI admite `--output-dir` (`cli.py:1720`); `get_base_output_dir`, en `utils.py:373`, utiliza argumento o almacenamiento del usuario. Se sube exclusivamente `generated/<id>/*`.

**Impacto:** `result.json` se redirige a la carpeta esperada, pero el cliente y HAR se guardan en otra ubicación; no se empaqueta explícitamente el cliente real. Las rutas del JSON pueden referirse al runner efímero.

**Arreglo:** pasar `--output-dir` explícitamente, validar `script_path`, copiar un paquete de entrega completo y excluir HAR/secretos. No asumir que un JSON con rutas constituye un entregable.

### H04 — P1: el lenguaje seleccionado se ignora

**Evidencia:** `inputs.language` aparece en la configuración y resumen del workflow, pero no se transmite a la configuración del motor. El comando de la interfaz (`math-studio.tsx:297`) tampoco aplica el selector. La CLI obtiene `output_language` desde ConfigManager.

**Arreglo:** definir contrato de lenguaje por ejecución, añadir una opción CLI validada o generar configuración aislada por trabajo. Incluir lenguaje efectivo y extensión real en el manifiesto.

**Aceptación:** Python, TypeScript y JavaScript producen sus correspondientes archivos y ejemplos ejecutables.

### H05 — P1: fallos ocultados por el workflow

**Evidencia:** ejecución `:94` termina con `|| true`; push `:114` también oculta errores.

**Impacto:** GitHub puede indicar éxito cuando el agente ha fallado; se pueden publicar metadatos de error como resultado satisfactorio.

**Arreglo:** preservar el exit code, validar `status` y existencia de artefactos; cargar diagnóstico con `if: always()` sin convertir el trabajo fallido en exitoso.

### H06 — P1: la interfaz queda ejecutando y presenta un cliente simulado

**Evidencia:** `math-studio.tsx:251–260` cambia a `running` y crea un string fijo. No hay polling, suscripción ni descarga del resultado. No existe llamada `setStatus('completed')`. El enlace apunta a todas las ejecuciones del repositorio.

**Impacto:** el botón queda deshabilitado y el usuario puede copiar endpoints inventados o métodos sin implementación. El identificador de interfaz no se correlaciona con un resultado visible.

**Arreglo:** implementar seguimiento de ejecución, estados terminales, timeout, cancelación, recuperación tras recarga y artefacto real; mientras tanto marcar explícitamente la vista como demostración.

### H07 — P1: resultados matemáticos falsos al fallar Newton

**Evidencia:** `math-studio.tsx:279–285` devuelve constantes para cualquier expresión y etiqueta el resultado como calculado localmente. No ejecuta un motor local. Para `zeroes` devuelve una factorización, no raíces.

**Reproducción:** impedir la petición Newton y pedir derivar `x^2`: el fallback sigue dando `3x^2 - 3`.

**Arreglo:** mostrar error verificable; si se agrega cálculo local, utilizar un motor real y comprobar operación, dominio y resultado. Ningún fallo de red debe convertirse en una respuesta matemática inventada.

### H08 — P1: token persistente en el navegador y borrado incompleto

**Evidencia:** `math-studio.tsx:182–204`: lee PAT desde localStorage, persistencia activada inicialmente; desmarcar guardar no elimina el token anterior.

**Impacto:** cualquier JavaScript ejecutado en ese origen puede leer el token almacenado; riesgo especialmente relevante en equipos compartidos. No se identificó una vulnerabilidad XSS concreta.

**Arreglo:** para uso local, memoria y opción explícita de borrar; para servicio compartido, autenticación servidor y credenciales de GitHub de corta duración con permisos mínimos. No incrustar claves de proveedores en el frontend.

### H09 — P1, riesgo de diseño: herramientas y tráfico web con excesivos privilegios

**Evidencia:** `auto_engineer.py:252,264` usa `bypassPermissions`; `engineer.py:51–61` autoriza las demás herramientas; `opencode_engineer.py:444–470` responde `always`. El agente procesa información de sitios externos y puede ejecutar código.

**Impacto:** una instrucción maliciosa en contenido capturado puede influir sobre un proceso que dispone de shell, archivos y entorno. No se realizó una prueba de explotación.

**Arreglo:** worker desechable con usuario sin privilegios, filesystem limitado, sin credenciales Git ni acceso a carpetas personales; separar captura, generación y verificación. Conservar autonomía dentro del entorno restringido.

### H10 — P1, riesgo de datos: HAR y registros sensibles

**Evidencia:** `browser.py:299–300,383–384` captura contenido embebido; no se encontró una etapa central de redacción previa al modelo. Los prompts y mensajes también se persisten.

**Impacto:** capturas autenticadas pueden contener cookies, Authorization, tokens en URL y datos personales. Ignorar `*.har` en Git no resuelve el envío a proveedores ni la retención local.

**Arreglo:** conservar original sólo local y restringido, generar HAR saneado, filtrar hosts/campos/cuerpos, limitar tamaño y retención; utilizar fixtures sintéticas para probar que ningún secreto llega a prompts, logs ni artefactos.

### H11 — P2: JSON válido con esquema incorrecto rompe configuración

**Evidencia:** `config.py:50–63`; reproducción local con `[]` produce AttributeError. Capturar errores de sintaxis JSON no valida tipos ni enums. `SessionManager.load` también acepta sin esquema el contenido JSON.

**Arreglo:** validar objeto raíz, tipos, rangos y valores admitidos; avisar de configuración inválida y conservar copia recuperable. Validar también historial y contratos entre frontend y runner.

### H12 — P2: historial vulnerable a pérdida de actualizaciones concurrentes

**Evidencia:** `session.py` carga todo el historial en memoria y reemplaza el archivo al guardar. La sustitución es atómica, pero no hay bloqueo o transacción que combine escrituras concurrentes.

**Impacto:** dos procesos que parten de la misma versión pueden sobrescribir sus nuevas ejecuciones. Es una inferencia del flujo, no una prueba concurrente ejecutada.

**Arreglo:** bloqueo entre procesos y recarga dentro de la sección crítica o SQLite para uso local; base transaccional cuando haya varios workers.

### H13 — P2: interfaz monolítica y contratos débiles

**Evidencia:** 763 líneas en `math-studio.tsx`; tipos `any` para iconos, respuestas y errores; propietario/repositorio y rama `main` codificados.

**Arreglo:** separar catálogo de conectores, formulario, credenciales, visor y seguimiento; usar tipos de respuesta validados y `LucideIcon`. Configurar repositorio/rama. Agregar AbortController, timeout y manejo de errores de portapapeles.

### H14 — P2: errores pequeños que confunden el uso

**Evidencia:** `math-studio.tsx:585` muestra `.py` para JavaScript; `:292` copia generatedCode aunque esté activa la pestaña CLI; `:297` interpola texto en un comando shell sin escape específico para Bash/PowerShell. Sólo se comprueba que URL no esté vacía; prompt puede estar vacío.

**Arreglo:** mapa de extensiones, copiar la pestaña activa, comandos seguros por plataforma y validación real del formulario. No recomendar pegar un comando construido con entrada libre sin tratar correctamente sus argumentos.

### H15 — P2: CI no verifica el flujo nuevo

**Evidencia:** workflow del sitio ejecuta build y regresión de cabecera/documentación; `website/tests/scroll_e2e.py` reúne `/` y rutas de documentación. No cubre despacho, resultados del Studio ni cálculo. No hay pasos de lint ni `types:check` explícitos en ese workflow. La cobertura Python omite CLI y navegador y no define umbral mínimo.

**Arreglo:** CI de PR con lint, tipos y pruebas del contrato; fixtures HTTP para errores y estados terminales; un E2E con sitio propio de prueba. Mantener pruebas live pagadas como smoke tests opcionales. Medir cobertura de caminos críticos antes de imponer una cifra global.

### H16 — P2: reproducibilidad y cadena de suministro inconsistentes

**Evidencia:** CI Python fija SHAs de acciones; workflow nuevo usa tags y `curl | sh`. Configuración permite paquetes dinámicos como `opencode-ai@latest` y `agent-browser@0`.

**Arreglo:** fijar versiones probadas para CI/producción y actualizar de forma deliberada; registrar inventario por ejecución. Ejecutar análisis de dependencias Python y Node y de secretos. Esta auditoría no ejecutó un escáner de vulnerabilidades; no se atribuyen CVEs sin evidencia.

### H17 — P2, producto: promesas de conectores todavía no verificadas

**Evidencia:** las plantillas describen extracción de pasos, ejercicios y cálculo interno, pero son prompts y URLs. El ejemplo SymPy es texto orientativo; no hay motor integrado. La interfaz anuncia ejecución gratis sin conocer presupuesto de modelos y cuenta.

**Arreglo:** distinguir plantilla experimental, conector validado y API oficial. Registrar fecha de verificación, capacidades reales, límites, atribución y método de acceso. Preferir APIs documentadas, contenido propio o integraciones permitidas. No asumir que una web que grafica dispone de un endpoint remoto de cálculo.

No se revisaron los términos individuales de esas plataformas: este hallazgo cuestiona las garantías del producto, no emite un dictamen jurídico sobre ellas.

### H18 — P2: el nuevo componente no pasa ESLint

**Evidencia:** ejecución local del ESLint instalado en `website/node_modules` sobre el componente y su página. Reporta `react-hooks/set-state-in-effect` en `math-studio.tsx:185`, por restaurar estado de credenciales sincrónicamente desde un efecto.

**Arreglo:** rediseñar la carga de preferencias como estado externo o inicialización cliente compatible con hidratación y la política de credenciales elegida. Incluir lint en CI y no silenciar la regla sin evaluar la causa. TypeScript pasa, por lo que comprobar únicamente tipos no detecta este fallo.

## 5. Arquitectura recomendada

Primera etapa: herramienta personal local con un solo worker; mantener el sitio estático como catálogo y documentación. Resolver entrega y seguimiento antes de introducir infraestructura de SaaS. GitHub Actions puede servir para trabajos ocasionales supervisados si se corrigen entradas, permisos y artefactos.

Si necesitas interfaz compartida, añadir un backend separado: la configuración actual `website/next.config.mjs` exporta archivos estáticos y no proporciona un servidor para credenciales y trabajos.

```text
Interfaz / CLI
    -> API de trabajos y catálogo de conectores
    -> registro persistente de trabajos
    -> worker aislado
         1. captura o consulta API oficial
         2. saneamiento y normalización
         3. generación de cliente
         4. validación independiente
    -> almacenamiento privado de artefactos
    -> estado y descarga autorizada
```

Contrato mínimo del trabajo: `id`, `schema_version`, usuario/proyecto, objetivo, conector, URL validada, lenguaje, commit, proveedor/modelo, fechas, estado, error estructurado, consumo y manifiesto de archivos. Estados: queued, running, succeeded, failed, cancelled y timed_out. Exigir idempotencia para evitar duplicados al reintentar.

Una ejecución correcta debe tener artefactos existentes y validación independiente del contrato. El autorreporte del agente puede ayudar a seguimiento, pero no sustituye ejecutar pruebas controladas.

Para producción compartida: límites de tiempo/CPU/memoria/costo, allowlist de destinos y bloqueo de redes privadas con revisión de redirecciones y resolución DNS. Esto es una necesidad del diseño futuro; no se afirma haber demostrado SSRF en el prototipo actual.

Separar tres dominios sin una reestructuración masiva inicial: motor de integración, control de trabajos y producto educativo. No añadir Redis, múltiples servicios o Kubernetes hasta necesitar concurrencia real. SQLite basta para un registro personal; PostgreSQL es una opción para usuarios concurrentes.

## 6. Cómo convertirlo en ahorro real de tiempo

### Flujo de desarrollo reutilizable

1. Escribir una ficha breve de problema, usuario, entrada, salida y criterio de éxito.
2. Buscar contrato/API documentada antes de capturar tráfico. Usar captura para sistemas propios, autorizados o sin documentación cuando corresponda.
3. Capturar únicamente una acción y sus endpoints relevantes; evitar enviar sesiones enteras al modelo.
4. Guardar contrato normalizado y fixtures saneadas; generar cliente Python o TypeScript con auth configurable, timeout, errores tipados y paginación.
5. Verificar en sandbox con casos de éxito, error, datos vacíos y límites. Reintentar automáticamente sólo operaciones apropiadas.
6. Integrar mediante un adaptador del proyecto y conservar procedencia, versión y tests del contrato.
7. Reutilizar el conector validado; regenerarlo únicamente cuando cambie el contrato.

Definición de listo de un conector: instalación reproducible, README, ejemplo, datos de prueba sin secretos, contrato versionado, límites conocidos y prueba verificable. Esto convierte una captura puntual en un activo reutilizable.

### Producto prioritario: extracción y exportación de conocimiento educativo

MVP: una fuente educativa y un conjunto pequeño de recursos —problemas, explicaciones, soluciones o datos científicos— extraídos de extremo a extremo. Entregar JSON original, JSON normalizado y manifiesto de procedencia, además del cliente reutilizable. Validar que otro proyecto pueda consumirlos sin depender de esta interfaz.

Separar tres capas: captura original saneada, normalización estructural y enriquecimiento opcional con IA. La captura conserva lo que dijo la fuente; la normalización cambia su representación; el enriquecimiento propone etiquetas y relaciones. Cada dato inferido debe registrar su origen y estado de revisión. No sustituir respuestas ausentes por invenciones de la IA.

Modelo común de recurso: identificador estable, tipo, título/enunciado, contenido estructurado, LaTeX/MathML si existe, idioma, imágenes y relaciones con ellas, tema, nivel según la fuente, respuestas/soluciones si existen, URL de procedencia, fecha, licencia conocida, versión del extractor y hash. Los campos ausentes quedan nulos. Las etiquetas estimadas por IA se guardan aparte de las declaradas por la fuente. Nivel educativo y dificultad no son equivalentes y requieren taxonomías distintas.

La validación inicial comprueba completitud, fórmulas, referencias a imágenes, paginación, duplicados y fidelidad al original. La comprobación simbólica puede añadirse cuando exista una respuesta verificable; no bloquea la extracción de contenido conceptual. La evaluación pedagógica y las rúbricas pertenecen a los proyectos consumidores.

Orden de oportunidades:

| Idea | Valor para ti | Dependencias | Prioridad |
|---|---|---|---|
| Conector educativo y exportación JSON | Lleva contenido de una fuente a varios proyectos | Corregir captura, entrega y pruebas | Primera |
| Normalización y clasificación con IA | Unifica fuentes y facilita búsquedas por tema/nivel | Esquema versionado y procedencia | Primera, tras validar captura |
| Datasets científicos para estadística | Aporta datos reales a clases y aplicaciones | Un proveedor documentado y datasets guardados | Segunda |
| Perfiles de desarrollo, diseño y marketing | Reutiliza el mismo motor en otras áreas de trabajo | Contratos de extracción por dominio | Según proyectos reales |
| Evaluadores y plataformas de práctica | Aprovechan el contenido en productos educativos | Datos confiables, respuestas y rúbricas | Proyectos consumidores |

Conservar todas las capacidades actuales, pero concentrar la validación inicial en una fuente y un flujo completo. La especialización se implementa con perfiles y conectores, no eliminando modos o lenguajes. El activo reutilizable es el conjunto de datos con trazabilidad y su mecanismo de actualización.

### Perfiles y entregables

Un perfil define tipos de recurso, campos, taxonomía, reglas de limpieza y validaciones. Los primeros perfiles serán matemáticas y ciencias; el motor seguirá aceptando objetivos generales. Una API puede exponer JSON útil directamente, mientras que HTML o PDF necesitan extractores distintos: no prometer que descubrir endpoints resuelve cualquier formato.

Paquete sugerido por extracción: `manifest.json`, `raw/` con respuestas saneadas, `normalized/items.json`, `enriched/items.json` si se solicitó IA, `assets/` cuando corresponda y `quality-report.json`. El manifiesto vincula conector, fuente, versión, fechas, hashes y restricciones conocidas. Evitar secretos en cualquiera de estas capas.

Requisitos de actualización: paginación completa, deduplicación por identificador/hash, checkpoint para reanudar, límites de tasa, backoff y comparación de versiones. El costo de clasificar con IA se reduce reutilizando resultados por hash y procesando sólo recursos nuevos o modificados.

## 7. Referencias externas contrastadas

Se consultaron páginas oficiales de repositorios el 18/10/2026. Estrellas aproximadas según la página consultada; cambian con el tiempo y no sustituyen evaluar arquitectura, licencia y mantenimiento. Se revisaron las descripciones y README, no se auditó su código completo.

| Repositorio | Estrellas aproximadas | Qué aprovechar | Decisión propuesta |
|---|---:|---|---|
| [microsoft/playwright](https://github.com/microsoft/playwright) | 98 mil | Pruebas con navegadores y contextos aislados | Aprovechar la tecnología existente para cubrir Studio y un objetivo de captura controlado |
| [fastapi/full-stack-fastapi-template](https://github.com/fastapi/full-stack-fastapi-template) | 46 mil | Patrones de API, persistencia, autenticación, cliente generado, Compose y pruebas | Tomar patrones del backend si hace falta servicio; conservar el frontend actual mientras sea útil |
| [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser) | 44,2 mil | Automatización de navegación orientada a agentes | Ya existe un adaptador: medirlo y fijar una versión antes de añadir otra herramienta |
| [sympy/sympy](https://github.com/sympy/sympy) | 15 mil | Cálculo simbólico en Python | Prototipar validación de respuestas de ejercicios propios; desarrollar por separado la explicación pedagógica |

Las recomendaciones de adopción son inferencias para este proyecto. Incorporar componentes mediante dependencias y adaptadores suele simplificar actualizaciones. Si se copia código, revisar su licencia y preservar los avisos correspondientes.

## 8. Backlog ejecutable y criterios de salida

Estimaciones orientativas para una persona familiarizada con el stack; dependen del tiempo disponible y acceso a proveedores.

| Fase | Trabajo | Criterio de salida | Esfuerzo orientativo |
|---|---|---|---|
| 0 | H01, H08–H10: entradas, permisos, secretos, aislamiento y redacción | Trabajo de prueba sin escritura Git, secretos ausentes de artefactos y shell inputs tratados como datos | 2–4 días |
| 1 | H02–H07: ejecutar fork, lenguaje/salida, errores y seguimiento real | Un flujo completo sobre sitio de prueba propio produce cliente descargable; error termina como error | 3–5 días |
| 2 | H11–H16: validación, estructura y CI | Tests de contrato y UI, tipos/lint y dependencias reproducibles; historial consistente | 3–5 días |
| 3 | Piloto de extracción educativa | JSON original y normalizado con procedencia, fórmulas y reporte de calidad; consumidos por otro proyecto | 5–8 días |
| 4 | Segunda fuente y reutilización | Dos fuentes compatibles con el esquema; actualización sin duplicados y uso en un segundo proyecto | Según piloto |

Primeras tareas concretas:

1. Añadir fixture de sitio/API local y contrato de resultado; permite arreglar sin pagar modelos repetidamente.
2. Corregir workflow con ejecución del checkout, inputs en env, permisos mínimos y artefactos.
3. Eliminar resultados matemáticos ficticios y separar ejemplo de cliente real.
4. Implementar identificación/seguimiento de run, fallos y descarga; transmitir lenguaje y salida.
5. Probar eliminación de PAT y redacción de secretos con fixtures.
6. Añadir validación de esquemas y pruebas del flujo Studio.
7. Extraer un conjunto pequeño de una fuente educativa, revisar fidelidad y exportarlo a un proyecto consumidor antes de ampliar el catálogo.

Métricas propuestas, con línea base medida antes del piloto: tiempo hasta primer dataset utilizable, porcentaje de registros completos, fidelidad de fórmulas e imágenes en una muestra revisada, duplicados, cobertura de paginación, costo por recurso normalizado, fallos por etapa y tiempo de integración en un segundo proyecto. Objetivo inicial: comparar dos tareas reales con y sin el sistema; fijar metas después de esa medición.

## 9. Pendientes para cerrar la auditoría operativa

- Preparar intérprete y dependencias bloqueadas; ejecutar pytest, ruff y mypy completos.
- Ejecutar build y prueba de navegador del Studio, además de TypeScript.
- Verificar Actions y Pages con la configuración real de la cuenta, sin asumir que secretos o permisos existen.
- Analizar dependencias/secretos y revisar políticas de retención, costos y destinos reales.
- Evaluar una captura autorizada de extremo a extremo y exactitud de cada conector antes de anunciarlo como compatible.

Se entrega diagnóstico y plan. No se modificó el comportamiento de la aplicación, no se desplegó ni se ejecutó el workflow remoto.
