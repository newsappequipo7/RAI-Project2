# Handoff FASE-2 → FASE-3 (por completar al cerrar la fase 2)

Responsable: · Fecha de cierre: · Tag: `fase-N-done`

## 1. Qué quedó funcionando (demostrable)
- 

## 2. Cómo correrlo desde cero
Comandos exactos, en orden, desde un clon limpio. Variables de entorno necesarias (nombres, no valores) y dónde
obtener cada una.

## 3. Estado de tareas
| ID | Estado | Evidencia | Nota |
|----|--------|-----------|------|

## 4. Desviaciones respecto a contratos o docs
Qué cambió respecto a lo escrito en `docs/architecture/` y por qué. Confirmar que los docs ya están actualizados.

## 5. Deuda y problemas conocidos
Qué no quedó bien, con severidad y sugerencia.

## 6. Gasto de IA de la fase
Tope de la fase: USD 3.00. Datos al 2026-10-03 (se completan al cerrar la fase).
- Según el ledger (`/costs`): USD 0.0160 en total, de los cuales `enrich` USD 0.0159 (5 llamadas pagadas y 2
  cacheadas). El resto es la llamada de prueba de la Fase 1.
- Según la consola de Anthropic: 6 810 tokens de entrada y 1 821 de salida, que a USD 1 / 5 por millón dan USD 0.0159;
  saldo USD 19.98. Diferencia con el ledger menor a 1 %. El panel de `/costs` puede marcar la alerta de más de 10 % por el
  redondeo a centavos de la consola con gastos tan pequeños: la comparación válida es por tokens.
- Costo medio por tarea: `enrich` USD 0.003183 por llamada pagada (≈ 20 % menos que el supuesto de USD 0.0040).
  Proyección: 80 noticias ≈ USD 0.25.

## 7. Qué necesita saber la siguiente persona antes de empezar
Top 3 cosas.

## 8. Loops registrados en esta fase
- [LOOP-005](../../evidence/loops/LOOP-005-enrich-calidad-y-costo.md): calidad del prompt `enrich.v1` y costo medio
  (USD 0.003183 por llamada, ledger y Console coinciden a menos de 1 %; importancia y alcance de Haití por afinar).
