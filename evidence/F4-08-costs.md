# Costo real por función (F4-08)

Fuente: `GET https://news-api.diegovalenzuela.workers.dev/admin/costs` · 2026-10-14T16:58:32.552Z · ledger D1. Solo llamadas reales pagadas: sin
caché, sin `mock` y con resultado `ok`.

| Función | Tokens entrada (prom.) | Tokens salida (prom.) | Costo por llamada (USD) | Llamadas pagadas | Gasto total (USD) |
|---|---|---|---|---|---|
| `enrich` | 1362 | 364 | 0.003183 | 5 | 0.0159 |
| `chat_answer` | 1172 | 356 | 0.000296 | 85 | 0.0251 |
| `digest` | 2985 | 721 | 0.000809 | 24 | 0.0194 |
| `embed` | 0 | 0 | 0.000000 | 145 | 0.0000 |

Gasto total del ledger: USD 0.0605 · nivel `normal` · llamadas evitadas (caché o abstención): 21 % de 365.

## Estimación de la demo (PRESUPUESTO-IA §5)

- Llamadas LLM estimadas: **255** (25 × 5 preguntas con 40 % evitadas + 3 ensayos × 60).
- Costo medio real de `chat_answer`: USD 0.000296.
- Estimación: **USD 0.075** (255 × 0.00029567) · reserva: USD 7.00.
- Cobertura de la reserva: 92.8× (7 / 0.0754 = 92.84) → cumple F4-08 CA2 (≥ 3×).
