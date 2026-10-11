# F4-05 — Set dorado y runner de evaluación

Fecha: 2026-10-11 · Responsable: Joaquín · Rama: `fase-4/f4-05-golden-set` (sobre F4-04) · Gasto de IA: USD 0
(sin corridas en vivo todavía)

| Archivo | Qué hace |
|---|---|
| `evals/chat-golden.jsonl` | 32 casos sobre ids estables del corpus semilla (`packages/shared/fixtures/news.json`) |
| `evals/src/golden.ts` | Esquema zod de un caso, lectura del JSONL y auditoría (mínimos por categoría, ids del corpus) |
| `evals/src/metrics.ts` | Puntaje por caso, agregados de CHAT-RAG §6 y objetivos de F4-06 |
| `evals/run-chat-evals.ts` | Runner: `/health`, preguntas en serie, tabla en consola, JSON en `evidence/evals/` |
| `services/api/src/rag/chat.ts` | En `env=dev`, los admins no consumen el rate limit; la clave de caché incluye `CHAT_CONFIG` |

**Distribución** (mínimos de CHAT-RAG §6 entre paréntesis):

| Categoría | Casos |
|---|---|
| Resumen/región | 8 (8) |
| Otro país | 6 (6) |
| Tema | 8 (8) |
| Fuera de corpus | 5 (5) |
| Inyección en la pregunta | 3 (3) |
| Retractadas | 2 (extra) |

Hay 7 casos con incertidumbre esperada: 5 en desarrollo y 2 disputadas.

## Criterios de aceptación

| Criterio | Estado | Evidencia |
|---|---|---|
| CA1: el runner produce métricas reproducibles | ☑ | `evals/src/metrics.test.ts` (10 pruebas). El set real pasa la auditoría. Se comprueban cada métrica sobre respuestas conocidas (abstención correcta y falsa, cobertura, precisión, incertidumbre, costo, p50 y p95), citas retractadas prohibidas, filtración del prompt, frases inyectadas y errores de transporte. Con las mismas respuestas, las métricas salen idénticas. También se listan los objetivos de F4-06 que fallan |
| CA2: costo por corrida < USD 0.15 | ☐ pendiente | Requiere la corrida base v1 en vivo |

```text
pnpm evals:chat --dry-run   Set dorado válido: 32 casos
pnpm lint / typecheck       OK
pnpm test                   OK: shared 289, Firestore 80, evals 10, admin 71, Worker 203 (653 pruebas)
```

## Corrida base v1 (pendiente, gasta créditos)

Requisitos:
- El Worker desplegado con F4-01 a F4-05 y `AI_MODE=live` en `env=dev`.
- El índice con el corpus semilla: hoy es la versión v11 con las 40 noticias semilla más 1 noticia editorial.
- Un token de un usuario que esté en `ADMIN_UIDS`.

```bash
EVAL_ID_TOKEN=<token> pnpm evals:chat --api https://news-api.diegovalenzuela.workers.dev --label v1
```

Costo estimado: 32 preguntas, de las cuales unas 20 llegan al modelo. A ≈ USD 0.004 por respuesta, son ≈ USD 0.08;
a eso se suman los digests de 3 ubicaciones (≈ USD 0.012). Si pasa de USD 0.15, el runner lo marca y hay que bajar
top-k o el extracto antes de seguir (CA2). Después de la corrida: registrar el LOOP con `/registrar-loop` y
completar este archivo con la tabla.

**Riesgo conocido:** los casos de resumen y región dependen de la ventana de 72 h. Si las noticias semilla
publicadas ya caducaron, el digest se abstiene y el chat cae a la búsqueda normal. Eso cuenta como falsa abstención
y es un hallazgo real del producto, no del runner.
