# F4-03 — Digest por ubicación

Fecha: 2026-10-11 · Responsable: Joaquín · Rama: `fase-4/f4-03-digest` (sobre F4-02) · Gasto de IA: USD 0
(`AI_MODE=mock`)

`GET /digest/:locationId` devuelve un `ChatResponse` con `mode = 'digest'`: un resumen de las 8 noticias mejor
ubicadas por `rankFeed` para esa ciudad con perfil neutro. Se genera la primera vez que alguien lo pide y se guarda
en KV junto con el `indexVersion`. El chat lo usa como atajo para «Resume lo más importante de hoy» o «¿Qué pasa en
mi zona?». Decisiones en [CHAT-RAG §5](../docs/domain/CHAT-RAG.md) («Implementación (F4-03)»).

| Archivo | Qué hace |
|---|---|
| `services/api/src/rag/digest.ts` | `selectDigestNews`, `getDigest` (perezoso), `refreshDigests` (invalidación selectiva) |
| `services/api/src/rag/answer.ts` | Llamada al modelo con reintento y validación, compartida por chat y digest |
| `services/api/src/rag/index.ts` | `upsert`/`remove`/`rebuild` invalidan solo los digests afectados |
| `services/api/src/routes/digest.ts` | Ruta con `requireAuth` y validación de la ubicación |
| `packages/shared/src/chat/intent.ts` | `generic`: la pregunta no trae tema ni otro detalle |

## Criterios de aceptación

| Criterio | Estado | Evidencia |
|---|---|---|
| CA1: la segunda consulta de digest para la misma ubicación e índice cuesta 0 | ☑ | `rag/digest.test.ts` «generates once and serves the second request…»: la segunda respuesta trae `cached = true`, `costUsd = 0` y los mismos bloques; el ledger tiene una fila `digest` pagada (0 en mock) y una `cached` |
| CA2: publicar una noticia de GT invalida solo digests de ubicaciones afectadas | ☑ | «publishing a Guatemala news invalidates only the digests it changes»: con digests de Madrid y Ciudad de Guatemala, publicar una noticia local de Guatemala devuelve `invalidatedDigests = ['gt-guatemala']`; el de Madrid se re-sella con el nuevo índice y la siguiente consulta sale de caché a costo 0 |

**Mutaciones** (aplicadas y revertidas en `refreshDigests`): invalidar siempre, como antes de F4-03, hace fallar la
prueba de CA2; no invalidar nunca hace fallar 4 pruebas (CA2, corrección/retiro de una noticia citada, `rebuild`
y regeneración tras un cambio).

Otras pruebas: la selección respeta la ventana de 72 h, toma 8 noticias, pone las esenciales primero y es la misma
para todos los lectores de una ciudad; el digest solo cita noticias de la selección; kill switch → `blocked`; sin
noticias recientes → `abstain`; `retrieval_only` lista la selección y no guarda nada; la ruta exige token y una
ubicación del catálogo; el chat usa el digest para preguntas genéricas de resumen o de «mi zona» y no lo usa si la
pregunta trae un tema («¿Qué pasa en mi zona con el dengue?»). `classifyIntent(...).generic` tiene 12 pruebas.

```text
pnpm lint             OK
pnpm typecheck        OK
pnpm test             OK: shared 289, Firestore 60, admin 71, Worker 202 (622 pruebas)
```

## Notas

- Antes de F4-03, cualquier publicación borraba **todos** los digests. Ahora se decide con el mismo código que elige
  las noticias del digest: si la selección de una ciudad no cambia y no cita la noticia modificada, el digest sigue
  valiendo. Una noticia muy importante de GT sí puede invalidar otras ciudades si entra en su top 8; es lo correcto.
- El Worker no lee `config/public` (Firestore): el digest usa la ventana por defecto de 72 h aunque el portal la
  cambie para la demo. Si se ajusta `feedWindowHours`, el digest y el feed pueden diferir; anotar en F4-09.
- Costo estimado por digest nuevo: similar a una respuesta del chat con 8 noticias de contexto, ≈ USD 0.004 con
  Haiku 4.5. `pnpm demo:prepare` (F4-09) calentará los 8 digests: ≈ USD 0.03 por índice.
