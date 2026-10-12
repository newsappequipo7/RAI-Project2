# F4-08 — Herramientas de medición (apoyo de Joaquín para Nelson)

Fecha: 2026-10-11 · Rama: `fase-4/f4-08-measurement-tools` · Gasto de IA: USD 0. La medición en sí sigue
**pendiente**: requiere el Worker desplegado en `live` ([handoff §3](../docs/handoffs/FASE-4.md), pasos 2, 4 y 9).

| Qué | Cómo |
|---|---|
| Latencia p50/p95 de `/chat` por modo | `pnpm evals:chat` imprime la tabla «Latencia por modo» y la guarda en `metrics.latencyByMode` del JSON de `evidence/evals/`. Claves: `abstain`, `digest`, `answer`, `retrieval_only` y `cached` (una respuesta servida de caché cuenta como `cached` sea cual sea su modo) |
| Costo real por función (PRESUPUESTO-IA §4) | `GET /admin/costs` trae ahora `taskStats`: llamadas reales por tarea (`ok`, sin caché, sin `mock`) con su número, tokens medios de entrada y salida y costo medio. `EVAL_ID_TOKEN=… pnpm evals:costs --api <worker> --out evidence/F4-08-costs.md` lo convierte en las filas de §4 |
| Reserva ≥ 3× la demo (PRESUPUESTO-IA §5, CA2) | El mismo reporte calcula 25 × 5 preguntas con 40 % evitadas + 3 ensayos × 60 = **255 llamadas**, por el costo medio real de `chat_answer`, y dice si la reserva de USD 7 lo cubre 3 veces. Si no lo cubre, indica bajar el modelo del chat en demo |

No incluye el tiempo de render del feed en el teléfono: hay que medirlo en Expo Go (F3-02 solo midió el ranking en
escritorio).

**Hallazgo:** el `avgCostPerCall` que usa el dashboard `/costs` cuenta las filas `mock` a costo 0, así que su «costo
medio» sale más bajo que el real. `taskStats` las excluye. Una prueba documenta la diferencia (`admin.test.ts`). Se
anotó como deuda en el handoff.

Pruebas: `taskStats` en `services/api/src/routes/admin.test.ts` (1). En `evals`, latencia por modo (1) y reporte de
costos y estimación de la demo (4).
