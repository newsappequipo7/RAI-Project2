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

Requisitos funcionales mínimos del enunciado (checklist global):

- [ ] Login con Google vía Firebase Auth en la app móvil.
- [ ] Login con Firebase Auth en el portal.
- [ ] Ubicación simulada seleccionable; la personalización depende de ella (no GPS).
- [ ] Chat como pantalla inicial; temporal (sin historial entre sesiones).
- [ ] Feed personalizado con jerarquía visual (posición/tamaño según relevancia).
- [ ] Vista de lectura por noticia.
- [ ] Aprendizaje de intereses por comportamiento, sin ocultar información local/nacional/internacional importante.
- [ ] Chat: resumir recientes, relevantes para mi región, explicar noticias de otro país, novedades sobre un tema.
- [ ] Chat con fuentes reconocibles y distinción hechos confirmados vs inciertos.
- [ ] Portal: crear y publicar noticias con procedencia y datos para relevancia.
- [ ] Portal: flujo para noticia sin imagen (obtener o generar), sin confundir IA con evidencia real.
- [ ] Forma práctica de instalar/probar en clase sin tiendas.
- [ ] Control de costos: gasto acumulado, saldo, costo por función, medidas de ahorro, reserva.

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
| F2-01 | Lista de noticias | ◐ | commits `05e0241`…`100058e` (rama `fase-2/f2-01-news-list`); CA1 y CA2 cubiertos por `firebase-tests/newsList.test.ts` (40 semilla, tiempo real entre dos admins) y filtros por 6 pruebas en `apps/admin`. Falta recorrido manual de la UI con login real |
| F2-02 | Editor de noticia | ◐ | rama `fase-2/f2-02-news-editor`; reglas de campos y guardia de guardado en `packages/shared/src/editorial/fieldRules.ts` (12 pruebas, las 40 semilla pasan); autoguardado a 2 s, markdown seguro y `newsStore` con pruebas en `apps/admin`; CA1 y CA2 contra el emulador en `firebase-tests/newsEditor.test.ts`. Implementadas las secciones Contenido y Clasificación; Fuentes, Afirmaciones, Imagen, Certeza e Historial llegan con F2-03, F2-05, F2-07 y F2-08. Falta recorrido manual de la UI con login real |
| F2-03 | Fuentes y afirmaciones | ◐ | rama `fase-2/f2-03-sources-claims`; helpers y estado calculado en `packages/shared/src/editorial/sources.ts` (14 pruebas) e integridad en `fieldRules.ts`; gestores de fuentes (con indicador de independencia) y afirmaciones en el editor; CA1 y CA2 contra el emulador en `firebase-tests/newsEditor.test.ts`. Falta recorrido manual de la UI con login real |
| F2-04 | Enriquecimiento con IA (Worker + UI) | ☐ | |
| F2-05 | Reglas de certeza y checklist (bloqueo de publicación) | ◐ | rama `fase-2/f2-05-publish-rules`; `packages/shared/src/editorial/validatePublish.ts` con 27 pruebas (CA1: una fuente → solo en desarrollo, misma organización, redes, contradicción, nota obligatoria, checklist, afirmación sin respaldo, imagen sin crédito, retractada; verificado además rompiendo reglas a propósito); selector, checklist, errores con salto al campo y botón bloqueado en `PublishSection`. El botón sigue deshabilitado aunque `ok = true` hasta que F2-06 lo conecte. Falta recorrido manual de la UI (CA2) con login real |
| F2-06 | Publicar e indexar | ◐ | rama `fase-2/f2-06-publish-index`; transacción de publicación con snapshot en `versions/{v}` y `indexPending` (`publishFlow.ts`, 4 pruebas unitarias + 5 contra el emulador: publica, rechaza lo que `validatePublish` no pasa, no publica dos veces, CA2 con Worker caído y reintento, reconstrucción); botón Publicar, estado de indexación con «Reintentar indexación» y enlace al comparador en el editor; «Reconstruir índice» y marca «indexación pendiente» en `/news`. Contrato nuevo: `News.indexPending`. Falta CA1 contra el Worker real (`indexVersion` en `/health`) y recorrido manual con login real |
| F2-07 | Imágenes | ◐ | rama `fase-2/f2-07-images`; ADR-010 (Cloudinary sin firma) y ADR-011 (ilustración IA sin proveedor); `cover/spec.ts` compartido con la app (F3-05) y constructores de imagen en `editorial/images.ts`; Worker `/admin/image/search` (Openverse + Commons, sin `NC`) y `/admin/image/generate` por el gateway; pestañas Subir foto, Licencia libre, Portada y, solo con el flag, Ilustración IA. CA1: pruebas de shared, Worker y emulador (publica con licencia libre y con portada). CA2: `forbidden` con el flag apagado en gateway y ruta. Falta crear el preset de Cloudinary y capturas de las pestañas con login real |
| F2-08 | Correcciones y retractación | ☐ | |
| F2-09 | Dashboard de costos | ☐ | |
| F2-10 | Pruebas del flujo editorial | ☐ | |
| F2-11 | Corpus editorial real | ☐ | |
| F2-12 | [PLUS] Vista previa móvil y cierre | ☐ | |
| F3-01 … F3-12 | Ver FASE-3 | ☐ | |
| F4-01 … F4-13 | Ver FASE-4 | ☐ | |

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
