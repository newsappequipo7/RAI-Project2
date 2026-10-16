# Handoff FASE-4 (estado al 2026-10-13, Worker en producción)

Responsable: Joaquín · Estado: **chat y evaluaciones en producción; faltan contenido de la demo, Android, ensayos y cierre** ·
Tag `demo-final` y cierre: pendientes

El Worker está desplegado en `live` con Claude Haiku 5.5 y el set dorado se corrió en vivo. Lo que falta es contenido y
ensayo: publicar el corpus, probar en un Android, ensayar y cerrar (§3 y §9).

## 1. Qué quedó funcionando (demostrable sin producción)

- **Chat en el Worker** (`POST /chat`, PR #31–#33):
  - intención por reglas y recuperación con filtros por intención;
  - abstención sin LLM por debajo de τ y caché en KV;
  - generación con el prompt `chat.v2` (incluye la ubicación simulada del lector) y validación en código: citas solo del top-k, certeza heredada de la BD y aviso de incertidumbre;
  - degradación a `retrieval_only` y `blocked` con kill switch o presupuesto;
  - digest por ubicación (`GET /digest/:locationId`) con invalidación selectiva al publicar.
- **Pantalla de chat en la app** (PR #34):
  - 4 sugerencias, bloques con chips de certeza y de fuente, y pie de procedencia;
  - «¿Cómo se generó?», estados de error e historial solo en memoria;
  - señal `chat_topic`.
- **Evaluación:**
  - set dorado de 34 casos y runner `pnpm evals:chat` (PR #35);
  - set de inyección con noticia maliciosa de prueba (PR #36);
  - guardia en código contra filtración del prompt.
- **Demo y presentación** (PR #37–#38):
  - guion de la sección 5 y prueba automática del flujo de retractación;
  - matriz RAI con enlaces;
  - mapa de evidencia de las secciones 6–10;
  - borrador de lecciones;
  - `pnpm report:ai-suggestions`.
- Pruebas: Worker 220 en verde el 2026-10-13 (las demás suites no se volvieron a correr tras el cambio de modelo; en `evals` hay 16).

## 2. Cómo correrlo desde cero

Requisitos: los del [handoff de F3](FASE-3.md) **más Java 21+ y `firebase-tools`**. Sin ellos, `pnpm test` falla en un
clon limpio (ver el [recorrido](../../evidence/F3-handoff-walkthrough.md)).

```bash
git clone https://github.com/newsappequipo7/RAI-Project2.git && cd RAI-Project2
nvm use 24 && corepack enable
npm i -g firebase-tools            # y un JDK 21+ (JAVA_HOME)
pnpm install --frozen-lockfile
pnpm lint && pnpm typecheck && pnpm test
pnpm evals:chat --dry-run          # valida el set dorado sin llamar a nada
pnpm -F mobile start --tunnel      # la app; el chat necesita el Worker desplegado (§3)
```

Variables (nombres, nunca valores):

| Variable | Para qué | Dónde se obtiene |
|---|---|---|
| `EVAL_ID_TOKEN` | Correr el set dorado | ID token de Firebase de un usuario en `ADMIN_UIDS` |
| `SEED_ID_TOKEN` | `pnpm seed`, `pnpm seed:injection` | ID token de Firebase de un usuario en `ADMIN_UIDS` |
| `EXPO_PUBLIC_API_URL` | Opcional en la app | Por defecto, el Worker del proyecto |
| `ANTHROPIC_API_KEY` | Solo como **secret del Worker** | Ya existe en Cloudflare; nunca en archivos ni en el entorno local |

Para `--target=prod`, los scripts usan `gcloud auth print-access-token`.

## 3. Pasos de producción y su estado

| # | Paso | Estado | Evidencia / lo que falta |
|---|---|---|---|
| 1 | Mezclar los PR #31 → #38 | ☑ | Ya en `main` (hasta el PR #40). Los commits de esta sesión están en una rama aparte |
| 2 | Desplegar el Worker en `live` | ☑ | `GET /health` → `aiMode: "live"`. El comando es `pnpm -F api run deploy --var AI_MODE:live` (sin `--` y escrito completo: con `AI_MODE:liv` el Worker queda en `mock` y no avisa) |
| 3 | Reescribir la semilla con horas actuales y reindexar | ☑ el 2026-10-12 · repetir | La ventana de 72 h la vuelve a dejar fuera: antes de cada ensayo y de la presentación, `unset SEED_ID_TOKEN; pnpm seed --target=prod` (sin token solo escribe Firestore) y después «Reconstruir índice» en `/news`. **No** usar `SEED_ID_TOKEN` ni `/indice`: reemplazan el índice solo con las 40 semilla |
| 4 | Corrida base del set dorado (F4-05) | ☑ | [`chat-20261013-0401.json`](../../evidence/evals/chat-20261013-0401.json), USD 0.0070 |
| 5 | LOOP de la corrida base | ☑ | [LOOP-015](../../evidence/loops/LOOP-015-corrida-base-y-limite-de-tokens-del-digest.md) |
| 6 | Set de inyección (F4-07) | ☑ | [`chat-injection-20261013-0419.json`](../../evidence/evals/chat-injection-20261013-0419.json): 0 fallos; la noticia se retiró del índice |
| 7 | Calibración (F4-06) | ☑ | LOOP-015 (tokens) y [LOOP-016](../../evidence/loops/LOOP-016-ubicacion-del-lector-en-el-prompt.md) (ubicación en el prompt). τ = 0.45 sin cambios |
| 8 | Prueba en teléfonos (F4-04 CA1) | ◐ | iPhone 16 Pro Max hecho ([F4-04](../../evidence/F4-04-chat-ui.md)); **falta un Android** y las capturas |
| 9 | Latencia y costo reales (F4-08) | ◐ | [F4-08-costs.md](../../evidence/F4-08-costs.md); reserva cubierta 92.8×. **Falta** medir `enrich` con Haiku 5.5 y repetir tras los ensayos |
| 10 | Cargar borradores D1, D2 y los 16 editoriales | ◐ | 18 borradores creados en Firestore el 2026-10-12. **Falta publicar** los 16 desde el portal (→ 56 noticias) |
| 11 | Elegir la noticia a retractar en la demo | ☐ | Propuesta: D1; anotarla en DEMO-RUNBOOK §2 |
| 12 | Tabla «IA sugirió vs editor publicó» | ☐ | `pnpm report:ai-suggestions --target=prod --out evidence/F4-11-ai-suggestions.md`, después de publicar con el asistente de IA |
| 13 | `demo:prepare` y videos de respaldo (F4-09) | ◐ | `pnpm demo:prepare` creado (revisa `aiMode`, flags, saldo y calienta los 8 digests). Falta correrlo y grabar los videos |
| 14 | Ensayos generales (F4-10) | ☐ | DEMO-RUNBOOK §4; anotar tiempos y gasto por ensayo (`env=demo`) |

Antes de cada sesión en vivo, revisar el saldo en `/costs`. En `dev`, el gateway degrada solo el chat a
`retrieval_only` desde USD 11 de gasto acumulado y bloquea todo desde USD 13 (PRESUPUESTO-IA §2).

## 4. Estado de tareas

| ID | Estado | Evidencia | Falta |
|---|---|---|---|
| F4-01 | ☑ | [F4-01](../../evidence/F4-01-chat-pipeline.md) | — |
| F4-02 | ☑ | [F4-02](../../evidence/F4-02-generation.md) | — |
| F4-03 | ☑ | [F4-03](../../evidence/F4-03-digest.md) | — |
| F4-04 | ◐ | [F4-04](../../evidence/F4-04-chat-ui.md) | CA1 en un Android y capturas (§3 paso 8) |
| F4-05 | ☑ | [F4-05](../../evidence/F4-05-golden-set.md), [LOOP-015](../../evidence/loops/LOOP-015-corrida-base-y-limite-de-tokens-del-digest.md) | — |
| F4-06 | ☑ | [LOOP-015](../../evidence/loops/LOOP-015-corrida-base-y-limite-de-tokens-del-digest.md), [LOOP-016](../../evidence/loops/LOOP-016-ubicacion-del-lector-en-el-prompt.md) | Anotar la configuración final en CHAT-RAG (`chat.v2`, `CHAT_MAX_TOKENS` 1500, τ 0.45) |
| F4-07 | ☑ | [F4-07](../../evidence/F4-07-injection.md) | — |
| F4-08 | ◐ | [F4-08-costs.md](../../evidence/F4-08-costs.md) | `enrich` con Haiku 5.5 y repetir tras los ensayos (paso 9) |
| F4-09 | ◐ | [F4-09](../../evidence/F4-09-demo-readiness.md) | `demo:prepare` y videos (Diego), borradores y retractación (pasos 10, 11, 13) |
| F4-10 | ☐ | — | Ensayos (paso 14) |
| F4-11 | ◐ | [F4-11](../../evidence/F4-11-evidence-pack.md) | Matriz RAI y evidencia de la presentación actualizadas con las corridas en vivo; falta la tabla de producción (paso 12), las capturas en teléfono y los aportes del equipo a las lecciones |
| F4-12 | ☐ | Este documento | §9 |

## 5. Desviaciones respecto a contratos o docs

Todas están documentadas en [CHAT-RAG](../domain/CHAT-RAG.md) (notas «Implementación F4-0X»),
[CONTRATOS-API](../architecture/CONTRATOS-API.md) §4 y [MODELO-DATOS](../architecture/MODELO-DATOS.md) §6:

- La caché del chat se consulta **antes** de la recuperación. Su clave incluye todo `CHAT_CONFIG`, la versión del
  prompt, el modo de IA, el `chatMode` y la historia.
- El digest se invalida solo si cita una noticia cambiada o si su ciudad elegiría otras noticias. Antes se borraban
  todos. El valor en KV guarda bloques y fuentes validados.
- En `env=dev`, los admins no consumen el rate limit (para el set dorado). En `demo` aplica a todos.
- Una abstención deja una fila `abstained` a costo 0 en el ledger (la «llamada evitada» del dashboard).
- Contratos nuevos en `@repo/shared`: `ChatRequest`/`ChatResponse` y sus zod, `healthResponseSchema` y
  `classifyIntent(...).generic`.

## 6. Deuda y problemas conocidos

| Severidad | Problema | Sugerencia |
|---|---|---|
| Alta | La semilla de producción caduca por la ventana de 72 h: el feed y el digest se quedan sin noticias recientes | Repetir la semilla y «Reconstruir índice» el día de cada ensayo y de la presentación (§3 paso 3) |
| Alta | `pnpm seed` con `SEED_ID_TOKEN` y «Indexar corpus semilla» de `/indice` reemplazan todo el índice con solo las 40 semilla: las editoriales publicadas dejan de aparecer en el chat | Reconstruir siempre desde `/news` → «Reconstruir índice», que indexa todo lo publicado |
| Alta | `AI_MODE` no se valida: cualquier valor distinto de `live` deja el Worker en `mock` sin avisar (ocurrió con `AI_MODE:liv`) | Comprobar `/health` después de cada despliegue; opcional: rechazar valores inválidos al arrancar |
| Media | Sin `temperature` las respuestas del chat ya no son deterministas (Haiku 5.5 la rechaza): las evals pueden variar entre corridas | Tratar cada medición como una muestra; repetir antes de afirmar un cambio fino |
| Media | q09 del set dorado no cita `n-mx-001`: queda por debajo de τ = 0.45, y bajar τ pondría en riesgo q31 (0.437), que debe abstenerse | No tocar τ sin probar los casos de abstención |
| Media | `enrich` se midió con Haiku 4.5; con 5.5 está sin medir (el precio baja unas 10×) | Medirlo al publicar el corpus con el asistente de IA |
| Media | No hay EAS Update: la app depende del túnel o del Plan B nativo | DEMO-RUNBOOK §3 |
| Media | El Worker no lee `config/public`: el digest siempre usa 72 h | Si se cambia `feedWindowHours` para la demo, el feed y el digest difieren |
| Media | La key de Anthropic vence el 2026-10-29 ([LOOP-003](../../evidence/loops/LOOP-003-costo-real-gateway.md)) | Renovarla antes de la presentación si es después de esa fecha |
| Media | El «costo medio por llamada» del dashboard `/costs` (F2-09) incluye las filas `mock` a costo 0, así que sale más bajo que el real | Para costos usar `taskStats` (`pnpm evals:costs`, con `--out ../evidence/...`: la ruta es relativa a `evals/`) |
| Media | En `mock` toda pregunta natural se abstiene (los embeddings son un hash) | Solo afecta el desarrollo local |
| Baja | Expo sugiere `expo` 57.0.25 → 57.0.28 | No actualizar antes de la demo sin probar en Expo Go |

## 7. Gasto de IA de la fase

Gasto total del ledger al 2026-10-13 (04:47 UTC): **USD 0.0596**, nivel `normal` (tope de desarrollo USD 13, tope del
proyecto USD 20). Incluye las corridas del set dorado (≈ USD 0.0064–0.0071 cada una), el set de inyección y el uso desde
la app. Detalle por función en [F4-08](../../evidence/F4-08-costs.md) y [PRESUPUESTO-IA §4](../ops/PRESUPUESTO-IA.md).
Estimación de la demo: USD 0.075 frente a una reserva de USD 7.00 (92.8×).

## 8. Qué necesita saber la siguiente persona

1. **El comando de despliegue es exacto:** `pnpm -F api run deploy --var AI_MODE:live`, sin `--` y con `live` completo.
   Un despliegue sin `--var` vuelve a `mock` (así lo fija `wrangler.toml`). Comprobar `/health` siempre.
2. **No dejar la noticia maliciosa de F4-07 en el índice.** Si se vuelve a correr el set, terminar con `--remove`.
3. **Un cambio de índice invalida la caché del chat y los digests;** un cambio de modelo o de `AI_MODE` invalida los
   digests guardados. Para medir sin caché, esperar 15 minutos o cambiar el índice.
4. **Las corridas en vivo cuestan ≈ USD 0.007 cada una.** Una variable por corrida y un LOOP por cambio (F4-06).
5. **Los tokens de admin duran 1 hora:** exportarlos como variable de entorno, nunca pegarlos en el chat ni en archivos.
   `pnpm evals:costs --out` usa una ruta relativa a `evals/`.
6. **Loops de la fase:** LOOP-013, 014, [015](../../evidence/loops/LOOP-015-corrida-base-y-limite-de-tokens-del-digest.md)
   y [016](../../evidence/loops/LOOP-016-ubicacion-del-lector-en-el-prompt.md).

## 9. Lista para el cierre final (F4-12)

- [ ] §3 pasos 8–14 hechos (Android, `enrich` con 5.5, borradores publicados, retractación elegida, tabla de sugerencias,
  `demo:prepare`, ensayos) y su evidencia enlazada en PLAN §6.
- [x] LOOPs de las observaciones que cambiaron el plan: LOOP-013 y LOOP-014.
- [x] LOOPs de la corrida base y de las 2 calibraciones: LOOP-015 y LOOP-016.
- [ ] Configuración final anotada en CHAT-RAG (`chat.v2`, `CHAT_MAX_TOKENS` 1500, τ 0.45).
- [ ] Este documento reescrito como estado final (después de los ensayos).
- [ ] Saldo real ≥ USD 5 antes del último ensayo, con el snapshot registrado en `/costs`.
- [ ] `git tag demo-final` sobre `main` congelado.

## 10. Loops registrados en esta fase

- [LOOP-013](../../evidence/loops/LOOP-013-invalidacion-selectiva-de-digests.md): invalidar solo los digests que cambian,
  con el mismo código que los elige (F4-03).
- [LOOP-014](../../evidence/loops/LOOP-014-doble-conteo-del-rate-limit.md): el rate limit del chat se contaba dos veces
  (F4-01 → F4-02).
- [LOOP-015](../../evidence/loops/LOOP-015-corrida-base-y-limite-de-tokens-del-digest.md): corrida base del set dorado y
  límite de tokens del digest con Haiku 5.5 (F4-05, F4-06).
- [LOOP-016](../../evidence/loops/LOOP-016-ubicacion-del-lector-en-el-prompt.md): la ubicación simulada del lector entra
  al prompt (F4-06).
