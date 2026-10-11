# F4-02 — Generación y validación

Fecha: 2026-10-11 · Responsable: Joaquín · Rama: `fase-4/f4-02-generation` (sobre F4-01) · Gasto de IA: USD 0
(`AI_MODE=mock` y proveedores simulados en pruebas)

Con `chatMode = 'full'` y al menos una noticia sobre τ, `/chat` hace una llamada al LLM por el gateway
(`temperature = 0`, salida JSON), reintenta una vez con un recordatorio de formato si la salida no es el JSON pedido
y valida en código antes de responder. Decisiones en [CHAT-RAG §2](../docs/domain/CHAT-RAG.md)
(«Implementación (F4-02)»).

| Archivo | Qué hace |
|---|---|
| `services/api/src/ai/prompts/chat.v1.ts` | Prompt de sistema según CHAT-RAG §3 y contexto delimitado y neutralizado |
| `services/api/src/rag/validate.ts` | `parseChatOutput` (zod) y `validateAnswer` (ids, certeza heredada, fuentes citadas) |
| `services/api/src/rag/chat.ts` | Pasos 8–10, degradación a `retrieval_only`, caché solo de respuestas sanas |
| `packages/shared/src/chat/certainty.ts` | `blockCertainty` (`mixta`), `lowestCertainty` (para la UI) |
| `services/api/src/ai/gateway.ts`, `types.ts` | `rateLimitApplied`: sin doble conteo del rate limit |
| `services/api/src/ai/mocks/fixtures.ts` | El mock del chat cita los ids del contexto |

## Criterios de aceptación

| Criterio | Estado | Evidencia |
|---|---|---|
| CA1: todas las pruebas pasan | ☑ | `rag/validate.test.ts` (9): JSON con prosa o bloque de código, JSON roto o con otra forma, id inventado junto a uno válido, bloque sin ids o sin texto, certezas mezcladas → `mixta`, el modelo dice «confirmado» y manda `certainty: confirmada` sobre una noticia `en_desarrollo` → prevalece `en_desarrollo` con aviso, ids duplicados y tope de 4 bloques. `ai/prompts/chat.v1.test.ts` (3): campos del contexto, neutralización de etiquetas en noticia, historia y pregunta, recordatorio solo en el reintento. `rag/chat.test.ts` (11): flujo completo con modelo simulado |
| CA2: ningún id fuera del top-k llega al cliente | ☑ | `validate.test.ts` «never lets an id outside the retrieved context reach the client» y `chat.test.ts` «drops citations to indexed news that were not retrieved»: un id que existe en el índice pero no fue recuperado y uno inventado no aparecen ni en `blocks` ni en `sources`. Mutación: quitar el descarte de ids fuera del contexto hace fallar las dos pruebas CA2 de validación |

Además, en `chat.test.ts`: el rate limit cuenta 1 por mensaje aunque se llame al modelo; el prompt contiene solo
las noticias recuperadas; abstención si ningún bloque sobrevive; JSON roto → reintento con «RECORDATORIO» y dos
filas en el ledger; dos salidas rotas → `retrieval_only` sin caché; error del proveedor → `retrieval_only`;
`insufficient` → aviso de respuesta parcial; respuesta repetida → `cached = true` y fila `cached` en el ledger.

```text
pnpm lint             OK
pnpm typecheck        OK
pnpm test             OK: shared 277, Firestore 60, admin 71, Worker 186 (594 pruebas)
```

## Costo estimado por respuesta (sin medir todavía)

Contexto de hasta 6 noticias × ~250 tokens + prompt de sistema ~450 ≈ 2 000 tokens de entrada y ≤ 700 de salida
(`CHAT_MAX_TOKENS`). Con Haiku 4.5 (USD 1 / 5 por millón): ≈ USD 0.002 + 0.0015 ≈ **USD 0.0035** por respuesta
nueva, en el peor caso, más el reintento si hay JSON roto. Con 30 casos del set dorado: ≈ USD 0.10, dentro del tope
de USD 0.15 por corrida de F4-05. Medición real pendiente en F4-05 y F4-08.

## Pendiente

- Ninguna llamada real todavía: la calidad del prompt (español, incertidumbre explícita, no especular) se mide con
  el set dorado en F4-05/F4-06 con `AI_MODE=live`.
- Inyección en el corpus (F4-07): el prompt ya delimita y neutraliza el contexto y la validación de ids es la
  defensa final; faltan los casos del set dorado y la noticia maliciosa en dev.
