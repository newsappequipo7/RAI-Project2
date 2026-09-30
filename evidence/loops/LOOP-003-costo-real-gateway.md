# LOOP-003 — Costo real frente a la tabla de precios del gateway
2026-09-29 · Diego · Tareas: F1-08

## Comprensión
El costo de cada llamada se calcularía con una tabla de precios (Haiku 4.5: USD 1 / 5 por millón de tokens, verificada
el 2026-09-29 en la documentación oficial) y un ledger en D1.

## Hipótesis
Si el ledger usa los tokens que devuelve el proveedor, debe coincidir con el panel de Anthropic.

## Construcción
Gateway único, ledger escrito antes de responder, umbrales 8/11/13/20 USD, `AI_MODE=mock` por defecto. Commit `ee8c8d4`.

## Prueba y observación
Una llamada real de `/admin/ai/selftest`: ledger 16 tokens de entrada y 4 de salida, USD 0.000036; Console → Uso
mostró 16 / 4. Coincidencia exacta. El costo por respuesta de chat (estimado en ADR-009 en ≈ USD 0.005) sigue sin
medirse: eso ocurre en la fase 4.

## Corrección / decisión
Mantener el Worker en `mock` y usar `wrangler deploy --var AI_MODE:live` solo de forma temporal. Incidente: se
detectó un `.env` con la key de Anthropic en el repo local (regla de oro 9); se detuvo el trabajo, se avisó y el
usuario lo vació. Además la key se creó con vencimiento (2026-10-29): hay que renovarla antes de la presentación.

## Rol de la IA en este loop
Claude Code escribió el gateway y las pruebas (72 en ese momento), pero volvió a desplegar en modo live antes de
verificar que el `.env` estuviera vacío: error propio, reconocido. La comprobación contra Console la hizo el usuario.
