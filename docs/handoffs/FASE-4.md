# Handoff FASE-4 (estado al 2026-10-11, antes de producción)

Responsable: Joaquín · Estado: **código de F4 en PR, sin desplegar** · Fecha de cierre y tag `demo-final`: pendientes

Todo el código de la fase está hecho y probado en `AI_MODE=mock` (USD 0). **Lo que falta ocurre en producción**:
desplegar el Worker, correr las evaluaciones en vivo, cargar datos y ensayar. Este documento dice qué hacer, en qué
orden, quién lo hace y cómo comprobar cada paso (§3). La sección 9 tiene la lista para el cierre final (F4-12).

## 1. Qué quedó funcionando (demostrable sin producción)

- **Chat en el Worker** (`POST /chat`, PR #31–#33):
  - intención por reglas y recuperación con filtros por intención;
  - abstención sin LLM por debajo de τ y caché en KV;
  - generación con el prompt `chat.v1` y validación en código: citas solo del top-k, certeza heredada de la BD y aviso de incertidumbre;
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
- Pruebas: 669 en verde (shared 293, Firestore 80, evals 11, admin 71, Worker 214).

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

## 3. Lo que falta en producción, en orden

| # | Paso | Quién | Comando / acción | Cómo se comprueba | Costo |
|---|---|---|---|---|---|
| 1 | Revisar y mezclar los PR **#31 → #38** en orden (con *merge commit*: son PR apilados) | Diego | GitHub | CI verde en cada PR | 0 |
| 2 | **Desplegar el Worker en `live`** desde `main` | Diego (cuenta de Cloudflare) | `pnpm -F api run deploy --var AI_MODE:live` | `GET /health` → `aiMode: "live"`; `POST /chat` sin token → `401` (hoy da `404`) | 0 |
| 3 | **Reescribir la semilla con horas actuales** y reconstruir el índice | Diego (`demo:prepare`) | `SEED_ID_TOKEN=… pnpm seed --target=prod` | En `/compare`, las noticias semilla vuelven a tener posición; `indexVersion` sube | Embeddings, casi 0 |
| 4 | Corrida base del set dorado (F4-05) | Joaquín | `EVAL_ID_TOKEN=… pnpm evals:chat --api https://news-api.diegovalenzuela.workers.dev --label v1` | JSON en `evidence/evals/`; costo de la corrida < USD 0.15 (CA2) | ≈ 0.09 |
| 5 | Registrar el LOOP de la corrida base | Joaquín | `/registrar-loop` | `evidence/loops/LOOP-0XX` con la tabla de métricas | 0 |
| 6 | Set de inyección (F4-07) | Joaquín | `pnpm seed:injection --api <worker>` → `pnpm evals:chat --set injection --api <worker>` → `pnpm seed:injection --api <worker> --remove` | 0 fallos de inyección; la noticia queda **fuera** del índice | ≈ 0.01 |
| 7 | Calibración (F4-06): mínimo 2 iteraciones, una variable a la vez | Joaquín | Cambiar una perilla en `services/api/src/rag/chatConfig.ts` (τ, top-k, extracto) o el prompt → desplegar → nueva corrida | 2 LOOPs con antes/después; objetivos: abstención correcta ≥ 90 %, falsas ≤ 15 %, incertidumbre ≥ 90 %, citas prohibidas 0 | ≈ 0.09 por corrida |
| 8 | Prueba en teléfonos (F4-04 CA1) | Joaquín | Expo Go en un iPhone y un Android: las 4 sugerencias, un chip de fuente, «¿Cómo se generó?» y una abstención | Capturas y modelo/sistema/versión de Expo Go en `evidence/F4-04-chat-ui.md` | ≈ 0.03 |
| 9 | Latencia y costo reales (F4-08) | Nelson | p50/p95 por modo: tabla «Latencia por modo» de `pnpm evals:chat` (pasos 4/7). Costos: `EVAL_ID_TOKEN=… pnpm evals:costs --api <worker> --out evidence/F4-08-costs.md` | Tabla de PRESUPUESTO-IA §4 completa; reserva ≥ 3× la estimación de la demo (§5) | 0 |
| 10 | Cargar borradores D1, D2 y los 16 editoriales | Daniel / Diego | `pnpm seed:editorial --target=prod` | Aparecen como **borrador** en `/news` (hoy no están) | 0 |
| 11 | Elegir la noticia a retractar en la demo | Daniel | Propuesta: D1 (encaja con el guion del chat) | Anotada en DEMO-RUNBOOK §2 | 0 |
| 12 | Tabla «IA sugirió vs editor publicó» | Joaquín / quien tenga gcloud | `pnpm report:ai-suggestions --target=prod --out evidence/F4-11-ai-suggestions.md` | Tabla con datos reales (requiere publicar con el asistente de IA) | 0 |
| 13 | `demo:prepare` y videos de respaldo (F4-09) | Diego | Calentar los 8 digests, revisar flags y saldo | Digests en caché; `/health` correcto | ≈ 0.03 |
| 14 | Ensayos generales (F4-10) | Todos | DEMO-RUNBOOK §4; el ensayo 1 estaba previsto el 14 oct | Tiempos y gasto por ensayo (`env=demo`) | ver PRESUPUESTO §5 |

Antes de cada sesión en vivo, revisar el saldo en `/costs`. En `dev`, el gateway degrada solo el chat a
`retrieval_only` desde USD 11 de gasto acumulado y bloquea todo desde USD 13 (PRESUPUESTO-IA §2).

## 4. Estado de tareas

| ID | Estado | Evidencia | Falta |
|---|---|---|---|
| F4-01 | ☑ | [F4-01](../../evidence/F4-01-chat-pipeline.md) | — |
| F4-02 | ☑ | [F4-02](../../evidence/F4-02-generation.md) | — |
| F4-03 | ☑ | [F4-03](../../evidence/F4-03-digest.md) | — |
| F4-04 | ◐ | [F4-04](../../evidence/F4-04-chat-ui.md) | CA1 en teléfonos (§3 paso 8) |
| F4-05 | ◐ | [F4-05](../../evidence/F4-05-golden-set.md) | Corrida base y LOOP (pasos 4–5) |
| F4-06 | ☐ | — | Pasos 7 (2 LOOPs) y configuración final anotada en CHAT-RAG |
| F4-07 | ◐ | [F4-07](../../evidence/F4-07-injection.md) | Corrida del set de inyección (paso 6) |
| F4-08 | ☐ | — | Nelson (paso 9) |
| F4-09 | ◐ | [F4-09](../../evidence/F4-09-demo-readiness.md) | `demo:prepare` y videos (Diego), borradores y retractación (pasos 10, 11, 13) |
| F4-10 | ☐ | — | Ensayos (paso 14) |
| F4-11 | ◐ | [F4-11](../../evidence/F4-11-evidence-pack.md) | Tabla con datos de producción (paso 12); afirmaciones ☐ que dependen de F4-05 y F4-08; aportes del equipo a las lecciones |
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
| Alta | El Worker de producción no tiene el código de F4: `/chat` y `/digest` dan `404` | §3 pasos 1–2 |
| Alta | La semilla de producción se escribió el 10 de octubre; con la ventana de 72 h ya casi no entra al feed ni al digest | §3 paso 3, y repetirlo el día de la presentación |
| Alta | τ = 0.45 sin calibrar; la calidad real del chat no está medida | §3 pasos 4 y 7 |
| Media | En `mock` toda pregunta natural se abstiene (los embeddings son un hash) | Solo afecta el desarrollo local; para ver el chat de verdad hace falta `live` |
| Media | No hay EAS Update: la app depende del túnel o del Plan B nativo | DEMO-RUNBOOK §3 |
| Media | El Worker no lee `config/public`: el digest siempre usa 72 h | Si se cambia `feedWindowHours` para la demo, el feed y el digest difieren |
| Media | La key de Anthropic vence el 2026-10-29 ([LOOP-003](../../evidence/loops/LOOP-003-costo-real-gateway.md)) | Renovarla antes de la presentación si es después de esa fecha |
| Media | El «costo medio por llamada» del dashboard `/costs` (F2-09) incluye las filas `mock` a costo 0, así que sale más bajo que el real | Para F4-08 usar `taskStats` (`pnpm evals:costs`); decidir con Daniel si el dashboard pasa a usarlo |
| Baja | Expo sugiere `expo` 57.0.25 → 57.0.27 | No actualizar antes de la demo sin probar en Expo Go |

## 7. Gasto de IA de la fase

**USD 0 en llamadas de IA**: todo el trabajo usó `AI_MODE=mock`. No se consultaron el ledger ni el panel del proveedor
en esta fase. El gasto estimado de lo pendiente (§3) es ≈ USD 0.35, más las iteraciones de calibración y los ensayos.

## 8. Qué necesita saber la siguiente persona

1. **Nada del chat se puede ver de verdad hasta el paso 2 de §3.** La app ya tiene la pantalla; hoy muestra el error
   de servidor porque el Worker responde 404.
2. **No dejar la noticia maliciosa de F4-07 en el índice.** Si se usó el paso 6, siempre correr `--remove`.
3. **Loop de la corrida base:** [LOOP-015](../../evidence/loops/LOOP-015-corrida-base-y-limite-de-tokens-del-digest.md).
   La v2 salió casi toda de la caché; repetirla sin caché antes de usarla como medición.
4. **Las corridas en vivo gastan créditos:** cada una de ≈ USD 0.09. Una variable por corrida y un LOOP por cambio
   (F4-06); revisar el saldo antes.

## 9. Lista para el cierre final (F4-12)

- [ ] §3 pasos 1–14 hechos y su evidencia enlazada en PLAN §6.
- [x] LOOPs de las observaciones que cambiaron el plan: LOOP-013 y LOOP-014.
- [ ] LOOPs de la corrida base y de las 2 calibraciones (F4-05, F4-06). Hecho: [LOOP-015](../../evidence/loops/LOOP-015-corrida-base-y-limite-de-tokens-del-digest.md) (corrida base y calibración 1). Falta la calibración 2.
- [ ] Este documento reescrito como estado final.
- [ ] Saldo real ≥ USD 5 antes del último ensayo, con el snapshot registrado en `/costs`.
- [ ] `git tag demo-final` sobre `main` congelado.

## 10. Loops registrados en esta fase

- [LOOP-013](../../evidence/loops/LOOP-013-invalidacion-selectiva-de-digests.md): invalidar solo los digests que cambian,
  con el mismo código que los elige (F4-03).
- [LOOP-014](../../evidence/loops/LOOP-014-doble-conteo-del-rate-limit.md): el rate limit del chat se contaba dos veces
  (F4-01 → F4-02).
- Pendientes: corrida base del set dorado y 2 calibraciones (F4-05, F4-06), en producción.
