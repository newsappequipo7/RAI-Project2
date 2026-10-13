# Costo real por función (F4-08)

Fuente: `GET https://news-api.diegovalenzuela.workers.dev/admin/costs` · 2026-10-13T04:47:45.848Z · ledger D1. Solo llamadas reales pagadas: sin
caché, sin `mock` y con resultado `ok`.

| Función | Tokens entrada (prom.) | Tokens salida (prom.) | Costo por llamada (USD) | Llamadas pagadas | Gasto total (USD) |
|---|---|---|---|---|---|
| `enrich` | 1362 | 364 | 0.003183 | 5 | 0.0159 |
| `chat_answer` | 1170 | 350 | 0.000292 | 83 | 0.0243 |
| `digest` | 2985 | 721 | 0.000809 | 24 | 0.0194 |
| `embed` | 0 | 0 | 0.000000 | 141 | 0.0000 |

Gasto total del ledger: USD 0.0596 · nivel `normal` · llamadas evitadas (caché o abstención): 21 % de 357.

## Estimación de la demo (PRESUPUESTO-IA §5)

- Llamadas LLM estimadas: **255** (25 × 5 preguntas con 40 % evitadas + 3 ensayos × 60).
- Costo medio real de `chat_answer`: USD 0.000292.
- Estimación: **USD 0.07** · reserva: USD 7.00.
- Cobertura de la reserva: 93.9× → cumple F4-08 CA2 (≥ 3×).
