# LOOP-014 — El rate limit del chat se contaba dos veces
2026-10-11 · Joaquín (con Claude Code) · Tareas: F4-01 (detección), F4-02 (corrección)

## Comprensión
CHAT-RAG §2 paso 1 fija 20 mensajes por hora y por `uid`, aplicados al entrar al chat, antes de saber si el mensaje
terminará en abstención, caché, digest o una llamada al modelo. Desde F1-08 el gateway también aplicaba el límite: en
`gateway.run`, cada llamada `chat_answer` con `uid` ejecutaba `consumeRateLimit`.

## Hipótesis
Aplicar el límite en la ruta (paso 1) y dejar el del gateway como estaba no tendría efecto visible: el gateway solo
actuaría como una segunda barrera.

## Construcción
En F4-01, la ruta `/chat` consume el límite en el paso 1 (`services/api/src/rag/chat.ts`). Al leer `gateway.ts` para
reutilizar la política de presupuesto, se vio que el gateway volvía a consumirlo en cada `chat_answer`. En F4-01 no
había generación, así que no ocurría todavía. Se anotó como riesgo para F4-02 en
[F4-01](../F4-01-chat-pipeline.md) («Notas para las tareas siguientes»).

## Prueba y observación
- En F4-02 se agregó la prueba «consumes the rate limit once per message even when the model is called»
  (`services/api/src/rag/chat.test.ts`): tras un mensaje que llega al modelo, `SUM(count)` en `rate_limits` debe ser 1.
- **Mutación medida hoy** (quitando la marca de la corrección, revertida): la prueba falla con `expected { total: 2 }
  to deeply equal { total: 1 }`. Un mensaje respondido por el modelo contaba **2**.
- Consecuencia deducida del código, no medida: con el reintento por JSON roto, el gateway se llama dos veces y el
  mensaje contaría **3**. Un lector que recibe respuestas generadas habría tenido unos 10 mensajes por hora en vez de 20,
  menos con reintentos, mientras las abstenciones y la caché contaban 1. El límite habría dependido del modo de respuesta.

## Corrección / decisión
- `GatewayContext.rateLimitApplied` (`services/api/src/ai/types.ts`): cuando la ruta ya consumió el límite, el gateway
  no lo vuelve a consumir. La generación del chat pasa esa marca; el digest no la necesita, porque usa la tarea
  `digest` y el gateway solo limita `chat_answer`. Se mantiene el consumo del gateway para cualquier otro llamador que no lo haya aplicado, así que las pruebas de F1-08 siguen igual. Commit `cdebcf7` (PR #32).
- Decisión relacionada, tomada después (F4-05): en `env=dev` los admins quedan exentos del límite para correr el set
  dorado completo (más de 20 preguntas); en `demo` aplica a todos ([F4-05](../F4-05-golden-set.md)).

## Rol de la IA en este loop
Claude Code detectó el doble conteo al leer el gateway en F4-01, antes de que existiera la generación, y lo dejó anotado
en vez de corregirlo fuera de alcance. En F4-02 propuso la marca `rateLimitApplied` y la prueba de conteo. Al principio
no corrió la mutación: la cifra «2» de este registro se obtuvo el 2026-10-11 al reconstruir el loop. El «3» con
reintento se deduce del código y no se midió.
