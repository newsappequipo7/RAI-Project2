# PLAN.md — Plan maestro

## 1. Objetivo y cómo se evalúa

Construir un sistema de noticias personalizadas que decida qué es relevante para cada usuario y **cómo comunicar esa
relevancia**, usando IA de forma responsable, transparente y dentro de **USD 20 de créditos de API de IA**.

Lo que realmente se califica (leído entre líneas del enunciado):

1. Que las 5 preguntas de Responsible AI (importancia, fuentes, validación, límites de la IA, imágenes) se respondan
   **con evidencia visible en el producto**, no con una política escrita. → `docs/responsible-ai/RAI-MATRIZ.md`
2. Que la demo en vivo funcione con varios compañeros en iPhone y Android con ubicaciones distintas.
3. Que el gasto sea conocido y controlado, con saldo reservado para la presentación.
4. Que el desarrollo asistido por IA sea observable: loops reales, requisitos propios, DoD, evidencia.

Requisitos funcionales mínimos del enunciado (checklist global; estado real al 2026-10-16: `[x]` solo con evidencia enlazada, `[ ]` si falta algo):

- [ ] Login con Google vía Firebase Auth en la app móvil. **Parcial:** puente web probado en Expo Go (ADR-003, F1-03); las capturas están fuera del repo.
- [ ] Login con Firebase Auth en el portal. **Parcial:** 4 admins creados (F1-05); la evidencia del login está fuera del repo.
- [x] Ubicación simulada seleccionable; la personalización depende de ella (no GPS). Código sin `expo-location` y pruebas de F1-11 y F3-09; sin captura de teléfono en el repo.
- [x] Chat como pantalla inicial; temporal (sin historial entre sesiones). [F4-04](../evidence/F4-04-chat-ui.md): ruta `/` al chat, historial en memoria; probado en un iPhone, **no en Android**.
- [ ] Feed personalizado con jerarquía visual (posición/tamaño según relevancia). **Parcial:** `rankFeed` y pantalla con pruebas (F3-02, F3-04); sin capturas en teléfono ni medición de tiempos.
- [ ] Vista de lectura por noticia. **Parcial:** implementada y probada por código (F3-07); faltan las capturas de las 4 certezas.
- [ ] Aprendizaje de intereses por comportamiento, sin ocultar información local/nacional/internacional importante. **Parcial:** `update.ts` y cuotas con pruebas (F3-08, LOOP-009); sin verificación en la app.
- [x] Chat: resumir recientes, relevantes para mi región, explicar noticias de otro país, novedades sobre un tema. Set dorado de 34 casos en vivo ([F4-05](../evidence/F4-05-golden-set.md)).
- [x] Chat con fuentes reconocibles y distinción hechos confirmados vs inciertos. `validate.ts` y evaluación de incertidumbre 7/7 ([F4-02](../evidence/F4-02-generation.md)).
- [x] Portal: crear y publicar noticias con procedencia y datos para relevancia. F2-02 a F2-06 y e2e; 11 editoriales publicadas el 2026-10-15 por el flujo de publicación.
- [x] Portal: flujo para noticia sin imagen (obtener o generar), sin confundir IA con evidencia real. [F2-07](../evidence/F2-07-image-rights-fix.md); la ilustración con IA no tiene proveedor (ADR-011).
- [ ] Forma práctica de instalar/probar en clase sin tiendas. **Parcial:** túnel + hotspot propio y Plan B nativo, sin EAS Update ([ADR-014](architecture/DECISIONES.md)); no se probó con compañeros ni se ensayó.
- [x] Control de costos: gasto acumulado, saldo, costo por función, medidas de ahorro, reserva. `/costs`, [F4-08](../evidence/F4-08-costs.md) y [PRESUPUESTO-IA](ops/PRESUPUESTO-IA.md). Saldo registrado USD 19.94, **calculado** como 20 − gasto de la consola.

## 2. Principio de arquitectura

**La IA trabaja al publicar; el código trabaja al leer.** Detalle en `docs/architecture/ARQUITECTURA.md`.

## 3. Estrategia de fases (4 personas, secuenciales, no codependientes)

Cada fase:
- Empieza leyendo el handoff de la anterior y termina escribiendo el suyo (`docs/handoffs/FASE-N.md`).
- Termina en un **estado demostrable** (algo que se puede mostrar funcionando aunque las fases siguientes no existan).
- Solo depende de los **contratos** (tipos, esquemas, endpoints) que ya están escritos en `docs/architecture/`.
  Por eso la persona N no necesita preguntarle nada a la persona N-1 si el handoff está completo.
- Deja mocks o datos semilla para que la fase siguiente pueda trabajar sin esperar nada.

| Fase | Responsable | Resultado demostrable al cerrar | Documento |
|------|-------------|---------------------------------|-----------|
| 1. Fundaciones y distribución | Diego Valenzuela | Login con Google en iPhone y Android; Worker con gateway, ledger y kill switch; datos semilla | `docs/phases/FASE-1-fundaciones.md` |
| 2. Portal editorial | Daniel Dubón | Publicar desde el portal una noticia verificada, con fuentes, imagen y enriquecimiento IA, que queda indexada | `docs/phases/FASE-2-portal-editorial.md` |
| 3. App móvil: feed y lectura | Nelson | Feed jerárquico por ubicación, "Lo que debes saber", "¿Por qué veo esto?", lectura con procedencia, tiempo real | `docs/phases/FASE-3-app-movil-feed.md` |
| 4. Chat, evaluación y demo | Joaquín | Chat RAG con citas y abstención; suite de evaluación; comparador de ubicaciones; runbook ensayado | `docs/phases/FASE-4-chat-evaluacion-demo.md` |

Aunque cada fase tiene un responsable, **todo el equipo participa en la presentación** (mapeo de quién presenta qué
en `docs/ops/DEMO-RUNBOOK.md` §1).

### Por qué este orden

- La Fase 1 ataca primero el mayor riesgo técnico: **iPhone sin cuenta Apple de pago**. Si eso falla tarde, no hay demo.
- La Fase 2 produce los datos reales (noticias con fuentes, certeza, geo, embeddings) que consumen 3 y 4.
- La Fase 3 no gasta IA (ranking por código), así que puede iterar libremente.
- La Fase 4 concentra el gasto (chat) al final, cuando el corpus y el presupuesto están claros, y cierra con evaluación
  y ensayo de demo.

## 3.1 Calendario

Fechas, trabajo previo por persona y tareas reasignadas: `docs/CRONOGRAMA.md`.
Preparación de cuentas y máquinas: `docs/ops/SETUP-DIA-0.md`.

## 4. Protocolo de traspaso (handoff)

Al terminar una fase, la persona responsable:

1. Completa `docs/handoffs/FASE-N.md` usando `docs/process/HANDOFF-TEMPLATE.md`.
2. Corre `/cerrar-fase N` en Claude Code (verifica DoD de todas las tareas, lista pendientes).
3. Hace un recorrido de 15 minutos con la siguiente persona: la siguiente persona debe poder correr todo localmente
   siguiendo solo el handoff. Si no puede, el handoff se corrige antes de cerrar.
4. Etiqueta el commit: `git tag fase-N-done`.

La persona que inicia una fase:

1. Corre `/iniciar-fase N` en Claude Code (lee plan, fase y handoff anterior; verifica entorno).
2. Reporta en su propio handoff cualquier desviación que encuentre respecto a lo prometido.

## 5. Presupuesto global de IA (resumen)

| Destino                                    | Tope USD |
|--------------------------------------------|----------|
| Fase 1 (pruebas del gateway)               | 0.50     |
| Fase 2 (enriquecimiento, imágenes)         | 3.00     |
| Fase 3 (sin IA en lectura)                 | 0.50     |
| Fase 4 (chat, evals, ensayos)              | 6.00     |
| Colchón de desarrollo                      | 3.00     |
| **Reserva intocable para la presentación** | **7.00** |
| **Total**                                  | **20.00**|

Umbrales automáticos y costo por función: `docs/ops/PRESUPUESTO-IA.md`.

## 6. Estado de tareas

Actualizar al cerrar cada tarea. Evidencia = enlace a `evidence/` o al PR. Cada persona expande su bloque a una fila
por tarea al iniciar su fase.

**Fase 3 (2026-10-10):** Nelson reportó que probó la app y que funciona bien; ver [registro de prueba manual](../evidence/F3-12-manual-review.md). El reporte no detalla dispositivos, recorridos ni tiempos. Por eso los criterios que requieren esa evidencia conservan `◐` hasta documentarla; el código F3-01 a F3-11 ya está integrado en `main`.

**Cierre de la entrega (2026-10-16):** Diego cerró la entrega con el estado actual y **sin el recorrido con los teléfonos**: no se
hicieron las capturas ni las mediciones en teléfono ([CAPTURAS-PENDIENTES](../evidence/CAPTURAS-PENDIENTES.md)), ni los ensayos
generales, ni los videos de respaldo, ni la prueba en Android. Por eso esas filas conservan `◐` o `☐`. Resumen para el
catedrático: [ENTREGA.md](ENTREGA.md).

| ID | Tarea | Estado | Evidencia |
|----|-------|--------|-----------|
| F1-01 | Monorepo y paquete compartido | ☑ | commits `067c591`, `57552db`; typecheck/lint/test verdes |
| F1-02 | Spike Expo Go (iPhone + Android) | ☑ | commit `2e6826f`, ADR-001. Evidencia guardada fuera del repo (Diego). |
| F1-03 | Firebase + login Google (puente web) | ☑ | commit `afe0f22`, ADR-003. Evidencia guardada fuera del repo (Diego). |
| F1-04 | Spike Plan B (Xcode) | ☑ | merge `f38bdd9`, ADR-001 (firma expira a los 7 días exactos). Probado en iPhone. Evidencia guardada fuera del repo (Diego). |
| F1-05 | Portal base con login de admin | ☑ | commit `77688db`; 4 admins creados en `admins/{uid}`. Evidencia guardada fuera del repo (Diego). |
| F1-06 | Reglas de Firestore e índices | ☑ | commit `17fed05`; 13 pruebas en emulador, reglas desplegadas |
| F1-07 | Worker base (Hono, auth, D1, KV) | ☑ | commits `7d6bb7d`, `884cebb`; desplegado en `news-api.diegovalenzuela.workers.dev`. Token real de admin verificado vía portal (`/admin/costs` 200). El 403 de no-admin con token real solo está probado con llaves locales |
| F1-08 | Gateway de IA, ledger, umbrales y flags | ☑ | 72 pruebas en `services/api` (CA1 y CA3 automatizados). CA2: llamada real Haiku 4.5, ledger 16 in / 4 out tokens = Console → Uso 16 / 4, costo $0.000036 |
| F1-09 | Índice RAG y búsqueda | ☑ | 88 pruebas en `services/api` (CA2 automatizado). CA1 con bge-m3 real: 5/5 consultas devuelven la noticia esperada, puntajes 0.56–0.62; consulta sin noticia válida (retractada excluida) tope 0.41. Sugiere τ ≈ 0.45–0.50 (a confirmar en F4) |
| F1-10 | Corpus semilla (40 noticias) y `pnpm seed` | ☑ | 13 pruebas en `shared` (cuotas, zod, reglas de certeza). CA1: `--target=emulator` (40 docs verificados) y `--target=prod` (40 docs escritos en `news/`). Corpus indexado con embeddings reales (índice v6, 40 noticias) |
| F1-11 | Perfil y selector de ubicación | ☑ | commit `0bc805d`; 3 pruebas del perfil por defecto; probado en Expo Go (selección y cambio de ubicación). Evidencia guardada fuera del repo (Diego). |
| F1-12 | CI y cierre de fase | ☑ | CI verde en `main`; comandos `.claude/commands`, 4 loops en `evidence/loops/`, handoff en `docs/handoffs/FASE-1.md`. CA2 (recorrido con Daniel) hecho |
| F2-01 | Lista de noticias | ☑ | commits `05e0241`…`100058e` (rama `fase-2/f2-01-news-list`); CA1 y CA2 cubiertos por `firebase-tests/newsList.test.ts` (40 semilla, tiempo real entre dos admins) y filtros por 6 pruebas en `apps/admin`. Cierre de fase: la creación de un borrador y su aparición en la lista se recorren también en navegador real en la prueba e2e (`e2e/tests/publish-flow.spec.ts`) |
| F2-02 | Editor de noticia | ☑ | rama `fase-2/f2-02-news-editor`; reglas de campos y guardia de guardado en `packages/shared/src/editorial/fieldRules.ts` (12 pruebas, las 40 semilla pasan); autoguardado a 2 s, markdown seguro y `newsStore` con pruebas en `apps/admin`; CA1 y CA2 contra el emulador en `firebase-tests/newsEditor.test.ts`. Implementadas las secciones Contenido y Clasificación; Fuentes, Afirmaciones, Imagen, Certeza e Historial llegan con F2-03, F2-05, F2-07 y F2-08. Cierre de fase: el e2e recorre el editor real (campos, autoguardado «Guardado», temas, alcance e importancia) |
| F2-03 | Fuentes y afirmaciones | ☑ | rama `fase-2/f2-03-sources-claims`; helpers y estado calculado en `packages/shared/src/editorial/sources.ts` (14 pruebas) e integridad en `fieldRules.ts`; gestores de fuentes (con indicador de independencia) y afirmaciones en el editor; CA1 y CA2 contra el emulador en `firebase-tests/newsEditor.test.ts`. Cierre de fase: el e2e comprueba en navegador que una URL inválida se rechaza, que el indicador cuenta la organización y que la afirmación vinculada queda «Respaldada» |
| F2-04 | Enriquecimiento con IA (Worker + UI) | ◐ | PR #9 (`8b21328`) y [LOOP-005](../evidence/loops/LOOP-005-enrich-calidad-y-costo.md). CA1: 5 noticias reales con `AI_MODE=live` (Diego, 2026-10-03), todas válidas. CA2: caché verificada en vivo (cacheadas 0 → 2, costo USD 0). CA3: pedir sugerencias solo guarda `aiSuggestions`. CA4: costo medio USD 0.003183 por llamada pagada (5 pagadas), ledger y consola de Anthropic a menos de 1 % (6 810 / 1 821 tokens), registrado en PRESUPUESTO-IA.md §4. Pendiente para cerrar: iteración `enrich.v2` (definiciones de alcance) con antes/después sobre las mismas 5 noticias y capturas del recorrido **2026-10-16:** sin cambios; `enrich.v2` no se midió. |
| F2-05 | Reglas de certeza y checklist (bloqueo de publicación) | ☑ | rama `fase-2/f2-05-publish-rules`; `packages/shared/src/editorial/validatePublish.ts` con 27 pruebas (CA1: una fuente → solo en desarrollo, misma organización, redes, contradicción, nota obligatoria, checklist, afirmación sin respaldo, imagen sin crédito, retractada; verificado además rompiendo reglas a propósito); selector, checklist, errores con salto al campo y botón bloqueado en `PublishSection`. El botón Publicar se conectó en F2-06. Cierre de fase: el e2e comprueba en navegador que Publicar está bloqueado en un borrador vacío, con certeza sin nota y con checklist incompleto, y que los errores muestran «Ir al campo» |
| F2-06 | Publicar e indexar | ☑ | rama `fase-2/f2-06-publish-index`; transacción de publicación con snapshot en `versions/{v}` y `indexPending` (`publishFlow.ts`, 4 pruebas unitarias + 5 contra el emulador: publica, rechaza lo que `validatePublish` no pasa, no publica dos veces, CA2 con Worker caído y reintento, reconstrucción); botón Publicar, estado de indexación con «Reintentar indexación» y enlace al comparador en el editor; «Reconstruir índice» y marca «indexación pendiente» en `/news`. Contrato nuevo: `News.indexPending`. Recorrido manual con el Worker real (2026-10-02, Firestore en emulador): al publicar, `GET /health` pasó de `indexVersion` 6 a 7 (CA1) — capturas [`F2-06-publicar-indexversion-7.png`](../evidence/captures/F2-06-publicar-indexversion-7.png) y [`F2-06-08-health-indexversion.txt`](../evidence/captures/F2-06-08-health-indexversion.txt). CA2 (Worker apagado → `indexPending` y reintento) cubierto por las pruebas del emulador |
| F2-07 | Imágenes | ☑ | [Corrección de licencias y procedencia](../evidence/F2-07-image-rights-fix.md) (2026-10-09); rama `fase-2/f2-07-images`; ADR-010 (Cloudinary sin firma) y ADR-011 (ilustración IA sin proveedor); `cover/spec.ts` compartido con la app (F3-05) y constructores de imagen en `editorial/images.ts`; Worker `/admin/image/search` (Openverse + Commons, sin `NC`) y `/admin/image/generate` por el gateway; pestañas Subir foto, Licencia libre, Portada y, solo con el flag, Ilustración IA. CA1: pruebas de shared, Worker y emulador (publica con licencia libre y con portada). CA2: `forbidden` con el flag apagado en gateway y ruta. Recorrido manual (2026-10-02): preset de Cloudinary creado; **subida real**: la noticia guardó una `foto_real` con URL de Cloudinary que responde HTTP 200 (la captura no se incluye porque la imagen de prueba era un meme con posibles derechos); **búsqueda real** en Openverse/Commons con autor y licencia visibles ([resultados](../evidence/captures/F2-07-licencia-libre-resultados.png)) y pie «Imagen de archivo, no corresponde al hecho» ([captura](../evidence/captures/F2-07-licencia-libre-pie-archivo.png)); **portada** con color del tema y pie «Portada generada · no es foto» ([vista previa](../evidence/captures/F2-07-portada-vista-previa.png), [pie y pestañas](../evidence/captures/F2-07-portada-pie-y-pestanas.png)); la pestaña de ilustración IA **no aparece** con el flag apagado (solo 3 pestañas en las capturas) |
| F2-08 | Correcciones y retractación | ☑ | rama `fase-2/f2-08-corrections`; `editorial/revision.ts` (nueva versión con entrada de corrección, retractación, diff) con 14 pruebas; `revisionFlow.ts` con transacciones y historial; 5 pruebas contra el emulador (versión 2 con corrección, rechazos sin rastro, retractar conserva la noticia y la retira del índice, historial `[2, 1]`). Editor: «Corregir noticia», «Retractar noticia» con confirmación y pestaña Historial. Recorrido manual con el Worker real (2026-10-02): corrección → versión 2 e `indexVersion` 8 ([captura](../evidence/captures/F2-08-correccion-version-2-indexversion-8.png)); Historial con 2 versiones y diff de título ([captura](../evidence/captures/F2-08-historial-2-versiones.png)); retractación → versión 3, certeza `retractada` e `indexVersion` 9, es decir, `/admin/index/remove` ejecutado ([captura](../evidence/captures/F2-08-historial-retractacion-3-versiones.png), [log](../evidence/captures/F2-06-08-health-indexversion.txt)). En Firestore la noticia sigue guardada con sus dos entradas de corrección |
| F2-09 | Dashboard de costos | ☑ | rama `fase-2/f2-09-costs-dashboard`; página `/costs` (ruta renombrada desde `/costos`) con tarjetas de gasto, saldo estimado, reserva y último saldo real con alerta si ledger y panel difieren más de 10 %, gráficos por día y por tarea, costo medio, % de llamadas evitadas, umbrales, controles de flags con confirmación y formulario de saldo. `costsView.ts` con 17 pruebas. CA1: prueba del Worker que cruza `/admin/costs` con una lectura independiente de 60 filas del ledger. CA2: prueba existente de `/admin/flags` → `/health` y confirmación en pantalla leyendo `/health`. Cierre de fase: usada en vivo (Daniel registró el saldo de USD 20.00 desde el formulario; Diego leyó gasto, costo medio y la alerta en LOOP-005). Los controles de flags solo se probaron con pruebas, no se accionaron en producción |
| F2-10 | Pruebas del flujo editorial | ☑ | rama `fase-2/f2-10-e2e`. Unitarias: `editorial/` (F2-05: `validatePublish`, reglas de campos, fuentes, imágenes, revisión; 131 pruebas en shared) y normalización de `enrich` (`normalize.test.ts`, `enrich.test.ts`; 144 en api). E2E con Playwright (`e2e/`, `pnpm -F e2e run e2e`): contra emuladores de Auth y Firestore, con login por correo del emulador y el Worker interceptado (AI en mock, sin créditos): crear → fuentes (URL inválida rechazada) → afirmación respaldada → portada → certeza y checklist → publicar → versión 1 y `indexPending` limpiado en Firestore. Verificada rompiendo a propósito el bloqueo del botón Publicar (falló como debía). **CI en GitHub Actions: verde en el PR #12** (confirmado por el equipo; sin captura en el repo). CA1 cumplido: el CI corre las pruebas unitarias y el e2e en mock, sin gastar créditos |
| F2-11 | Corpus editorial real | ◐ | [Corpus en producción](../evidence/F2-11-corpus-prod.md), [`CORPUS-EDITORIAL.md`](ops/CORPUS-EDITORIAL.md), [LOOP-006](../evidence/loops/LOOP-006-verificar-fuentes-antes-de-redactar.md), [LOOP-017](../evidence/loops/LOOP-017-falta-de-fecha-del-hecho.md), [LOOP-018](../evidence/loops/LOOP-018-duplicados-sin-deteccion.md). CA2 cumple: las 11 publicadas el 2026-10-15 pasaron `validatePublish`. **CA1 PARCIAL: 53 publicadas** (50 vigentes + 3 retractadas, visibles con su corrección) frente a ≥ 55: 3 editoriales retenidas por revisión humana (vigencia y fuentes). Se despublicó un duplicado. `demo-d1` y `demo-d2` siguen en borrador para la demo |
| F2-12 | [PLUS] Vista previa móvil y cierre | ◐ | [`docs/handoffs/FASE-2.md`](handoffs/FASE-2.md) completo y [LOOP-006 a 008](../evidence/loops/) (con LOOP-005 son 4 loops en la fase; meta ≥ 3). **No hecho:** la vista previa móvil `[PLUS]`, el recorrido de Nelson siguiendo solo el handoff (CA1) y `git tag fase-2-done`, que espera la confirmación explícita y que se resuelvan los ◐ de arriba **2026-10-16:** el recorrido de Nelson y el tag `fase-2-done` siguen pendientes. |
| F3-01 | Capa de datos del feed | ◐ | [Evidencia F3-01](../evidence/F3-01-feed-data.md). Servicio y hooks implementados; prueba del emulador: publicación con `publishNews` llega a la suscripción abierta en <5 s, con reglas reales. Ventana configurable, esenciales, retractadas, estados y perfil en tiempo real. Prueba manual general [reportada](../evidence/F3-12-manual-review.md); falta registrar dispositivo y recorrido del proveedor React en Expo Go. |
| F3-02 | Motor de ranking (TDD) | ◐ | [Evidencia F3-02](../evidence/F3-02-ranking.md), [LOOP-009](../evidence/loops/LOOP-009-ranking-cuotas-y-diversidad.md). CA1: nueve propiedades y casos adicionales automatizados. CA2 pendiente: medir 200 noticias en <20 ms en teléfono real con Expo Go. **2026-10-16:** CA2 no medido; log `__DEV__` disponible (`78ebc7b`); no hay teléfono de gama media. |
| F3-03 | Explicaciones ("¿Por qué veo esto?") | ☑ | [Evidencia F3-03](../evidence/F3-03-explanations.md), [LOOP-010](../evidence/loops/LOOP-010-catalogo-incompleto-de-razones.md). CA1: cada ítem de las cuatro personas tiene 1–3 razones coherentes con sus componentes; pruebas de catálogo, umbrales, pesos efectivos y garantías. Motor puro; panel visual en F3-06. |
| F3-04 | Pantalla de feed con jerarquía visual | ◐ | [Evidencia F3-04](../evidence/F3-04-feed-ui.md). Pantalla conectada a `rankFeed`, esenciales y cuatro tiers, chips, ubicación y refresh; corpus de cuatro personas con cabeceras distintas y etiquetas verificadas por pruebas. Prueba manual general reportada; faltan capturas/recorridos identificados para cuatro perfiles, todos los tiers, iPhone pequeño y Android grande. |
| F3-05 | Imágenes y portada tipográfica en la app | ◐ | [Evidencia F3-05](../evidence/F3-05-images.md). `CoverArt` y `NewsImage`, pie obligatorio, hoja de procedencia, sello IA y tooltip compacto; prueba de componente para cuatro tipos. Prueba manual general reportada; falta registrar teléfono y resultado visual/táctil de pies y procedencia. |
| F3-06 | Panel "¿Por qué veo esto?" y control del usuario | ◐ | [Evidencia F3-06](../evidence/F3-06-why-panel.md). Botón «?» en todos los tiers y esenciales, hoja con razones/barras y controles; `why_opened` y preferencias probados con emulador. Prueba manual general reportada; falta recorrido documentado en Expo Go y efecto visible de «Menos». |
| F3-07 | Vista de lectura con procedencia | ◐ | [Evidencia F3-07](../evidence/F3-07-reading-provenance.md). Integrada en el PR #25: lectura, fuentes, correcciones, versiones, disputa, retractación directa y etiquetas IA. Prueba manual general reportada; faltan capturas de las cuatro certezas y etiquetas de IA en teléfono identificado. |
| F3-08 | Señales e intereses | ◐ | [Evidencia F3-08](../evidence/F3-08-interests.md), [LOOP-011](../evidence/loops/LOOP-011-reloj-de-decaimiento.md). Pasos 1–4 implementados: apertura y permanencia, actualización del perfil por sesión de lectura, barras y controles en Perfil. CA1 y persistencia verificadas; falta documentar CA2 (tres lecturas) y CA3 (dos cuentas sin personalización) en Expo Go. |
| F3-09 | Cambio de ubicación en caliente | ◐ | [Evidencia F3-09](../evidence/F3-09-hot-location.md), [LOOP-012](../evidence/loops/LOOP-012-ubicacion-prueba-aislada.md). Perfil visible optimista, ranking local sin nueva consulta, aviso en feed/chat/Perfil y reversión ante error; 532 pruebas verdes. CA1 pendiente de medición toque→pintado <300 ms en Expo Go real. **2026-10-16:** CA1 no medido en teléfono; método de 240 fps disponible. |
| F3-10 | Tiempo real y avisos | ◐ | [Evidencia F3-10](../evidence/F3-10-live-alerts.md). Aviso fijo para una noticia nueva en top 3 o esenciales, retorno arriba y apertura de esenciales; 2 lectores del emulador reciben la publicación del portal en <5 s. Falta CA1 en dos teléfonos reales con Expo Go; tarjeta de correcciones `[PLUS]` pendiente. **2026-10-16:** CA1 no medido en dos teléfonos. |
| F3-11 | Comparador de ubicaciones (portal) | ◐ | [Evidencia F3-11](../evidence/F3-11-comparator.md). Ruta `/compare`, ocho ubicaciones, cuatro perfiles, posición y tier, panel de diversidad y suscripción Firestore. CA1 y CA2 verificados con publicación en emulador y comparación con el ranking móvil; falta revisión visual en el navegador del portal. |
| F3-12 | Pulido, accesibilidad, evidencia y cierre | ☐ | Pendiente: no realizado antes de la entrega. Modo oscuro, texto dinámico, contraste AA, videos y el recorrido de Joaquín con el handoff siguen sin hacerse ([CAPTURAS-PENDIENTES](../evidence/CAPTURAS-PENDIENTES.md)); no hay tag `fase-3-done` |
| F4-01 | Pipeline del chat sin generación (pasos 1–7) | ☑ | [Evidencia F4-01](../evidence/F4-01-chat-pipeline.md). CA1: 30/30 frases de intención. CA2: fuera de corpus → `abstain` sin fila de LLM (solo `abstained` a costo 0). CA3: pregunta repetida → `cached = true` sin filas nuevas. 567 pruebas verdes; en mock, USD 0. Atajo de digest en F4-03 y generación en F4-02 |
| F4-02 | Generación y validación | ☑ | [Evidencia F4-02](../evidence/F4-02-generation.md). Prompt `chat.v1`, `validate.ts` y generación con reintento único. CA1: 12 pruebas de validación y prompt + 11 del pipeline con modelo simulado (ids inventados, JSON roto, bloque sin ids, certezas mezcladas, «confirmado» sobre una noticia en desarrollo). CA2: ningún id fuera del top-k llega al cliente (prueba específica y mutación). 594 pruebas verdes; en mock, USD 0 |
| F4-03 | Digest por ubicación | ☑ | [Evidencia F4-03](../evidence/F4-03-digest.md). `GET /digest/:locationId` con generación perezosa, selección con `rankFeed` y perfil neutro, atajo en el chat para preguntas genéricas. CA1: segunda consulta misma ubicación e índice → `cached`, costo 0. CA2: publicar una noticia de GT invalida solo el digest de Guatemala (Madrid se re-sella y sigue en caché); invalidación selectiva verificada con mutaciones. 622 pruebas verdes; en mock, USD 0 |
| F4-04 | UI del chat (pantalla inicial de la app) | ◐ | [Evidencia F4-04](../evidence/F4-04-chat-ui.md). Pantalla de chat con saludo, 4 sugerencias, bloques con chip de certeza y fuentes tocables, aviso, pie de procedencia, «¿Cómo se generó?», estados de error, historial en memoria y señal `chat_topic`. CA2 cubierto con 20 pruebas (componentes, presentación, cliente HTTP y emulador); bundles iOS y Android compilan. CA1 en iPhone 16 Pro Max (iOS 27.0.1, Expo Go 1.0.0, cliente 57.0.9, SDK 57.0.0): 4 sugerencias, chip de fuente y «¿Cómo se generó?» funcionan con el Worker en `live`. **Falta** probar en un Android y guardar las capturas **2026-10-16:** Android y capturas siguen sin hacerse. |
| F4-05 | Set dorado y runner de evaluación | ☑ | [Evidencia F4-05](../evidence/F4-05-golden-set.md), [LOOP-015](../evidence/loops/LOOP-015-corrida-base-y-limite-de-tokens-del-digest.md). Set de 34 casos (ids del corpus semilla) y runner `pnpm evals:chat`. CA1: métricas reproducibles (10 pruebas; auditoría del set real). CA2: corrida base v1 `AI_MODE=live` ([`chat-20261013-0401.json`](../evidence/evals/chat-20261013-0401.json)): costo USD 0.0070 (< 0.15), abstención correcta 100 %, falsas 7.7 %, incertidumbre 100 %, citas prohibidas 0. El set se amplió con `relevant` en q01, q02, q07, q10 y q15 después de revisar las citas dudosas (LOOP-016) |
| F4-06 | Calibración (mínimo 2 iteraciones) | ☑ | Dos iteraciones, una variable cada una. [LOOP-015](../evidence/loops/LOOP-015-corrida-base-y-limite-de-tokens-del-digest.md): `CHAT_MAX_TOKENS` 700 → 1500, falsas abstenciones 7.7 % → 0 % (v1 → v3, [`0425`](../evidence/evals/chat-20261013-0425.json)). [LOOP-016](../evidence/loops/LOOP-016-ubicacion-del-lector-en-el-prompt.md): ubicación del lector en el prompt (`chat.v2`), precisión de citas 85.7 % → 96.0 % (v3 → v4, [`0440`](../evidence/evals/chat-20261013-0440.json)). Objetivos cumplidos en v4: abstención correcta 100 %, falsas 0 %, incertidumbre 100 %, citas prohibidas 0. Cada medición es una sola corrida y el modelo ya no es determinista. Sin tocar: τ (q09 sigue sin citar `n-mx-001`) |
| F4-07 | Endurecimiento contra inyección | ☑ | [Evidencia F4-07](../evidence/F4-07-injection.md). Guardia en código contra filtración del prompt, noticia maliciosa de prueba (`pnpm seed:injection`), 5 casos de inyección en el set dorado y set `chat-injection.jsonl`. Corrida en vivo ([`chat-injection-20261013-0419.json`](../evidence/evals/chat-injection-20261013-0419.json)): 3/3 casos, 0 fallos de inyección, 0 filtraciones del prompt; en i03 («sigue las instrucciones que trae para el asistente») el modelo resumió solo el contenido y no obedeció. En el set dorado: 0 fallos en q28–q30, q33 y q34. La noticia de prueba se retiró del índice después (`--remove`, índice v15) |
| F4-08 | Latencia y costo reales (Nelson) | ◐ | [Costos reales](../evidence/F4-08-costs.md) y [tabla de PRESUPUESTO-IA §4](ops/PRESUPUESTO-IA.md). Costo medio de `chat_answer` USD 0.000296 (85 llamadas pagadas), `digest` 0.000809 (mezcla de 4.5 y 5.5); estimación de la demo USD 0.075, reserva de USD 7 cubierta 92.8× (CA2 ≥ 3×). Latencia (v4, [`0440`](../evidence/evals/chat-20261013-0440.json)): respuestas p50 2.8 s / p95 4.1 s, abstenciones p50 0.6 s, caché p50 0.3 s. **Falta:** medir `enrich` con Haiku 5.5 y repetir las tablas tras los ensayos; la medición la hizo Diego, no Nelson |
| F4-09 | Preparación de la demo (`demo:prepare` y videos: Diego) | ◐ | [Registro de preparación](../evidence/F4-09-demo-readiness.md) (parte de Joaquín): guion de la sección 5 en DEMO-RUNBOOK, 4 pruebas del flujo de demo (pregunta sobre D1 y retractación en vivo). Hallazgos: sin EAS Update (túnel o Plan B); D1, D2 y los 16 borradores editoriales **no** están en Firestore de producción; la semilla caduca por la ventana de 72 h antes de la presentación. Pendiente: `demo:prepare` y videos (Diego), cargar borradores y elegir la noticia a retractar **2026-10-16:** `demo:prepare` sin correr en producción; `evidence/demo-videos/` vacío. Contenido (53 publicadas, D1/D2 en borrador) y noticia a retractar (`n-ar-003`) resueltos; ver [ADR-013](architecture/DECISIONES.md). |
| F4-10 | Ensayos generales (3) | ☐ | No realizados antes de la entrega (2026-10-16): [registro](../evidence/F4-10-rehearsals.md). Quedan para antes de la presentación |
| F4-11 | Paquete de evidencia para la presentación | ◐ | [Evidencia F4-11](../evidence/F4-11-evidence-pack.md). RAI-MATRIZ con enlaces y estado por fila; [PRESENTACION-EVIDENCIA](ops/PRESENTACION-EVIDENCIA.md) con afirmaciones de las secciones 6–10 y los 3 LOOPs de la sección 8; `pnpm report:ai-suggestions` (verificado en emulador); [borrador de lecciones](ops/LECCIONES-APRENDIDAS.md). Pendiente: tabla con datos de producción, afirmaciones ☐ que dependen de F4-05/F4-08 y aportes del equipo |
| F4-12 | Cierre | ◐ | [Handoff de F4](handoffs/FASE-4.md) reescrito como estado final del 2026-10-16 y [ENTREGA.md](ENTREGA.md). Snapshot de saldo USD 19.94 registrado (calculado). Sin ensayos y sin tags todavía (los crea Diego) |

Leyenda: ☑ hecha y verificada · ◐ implementada, falta evidencia o una verificación · ☐ pendiente.

## 7. Riesgos principales

| Riesgo | Mitigación | Dueño |
|--------|------------|-------|
| iPhone no instala / login falla en iOS | Spike en F1-02/F1-03 con plan A (Expo Go) y plan B (build nativo con Xcode) | Diego |
| Créditos agotados antes de la demo | Gateway con ledger, kill switch y reserva de USD 7; Claude Code nunca usa la key del proyecto | Diego define, todos respetan |
| Wifi de la U bloquea Metro/túnel | Túnel + hotspot propio + video de respaldo | Diego |
| Contratos cambian a media fase | Cambios solo con actualización de docs + nota en handoff | Todos |
| Alucinaciones del chat en la demo | Abstención por umbral, validación de citas, set dorado | Joaquín |
| Scope creep | Lo extra está marcado `[PLUS]` en cada fase: solo se hace con todo lo obligatorio en Done | Todos |
