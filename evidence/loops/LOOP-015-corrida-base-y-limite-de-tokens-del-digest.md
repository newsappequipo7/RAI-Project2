# LOOP-015 — Corrida base del set dorado y límite de tokens del digest
2026-10-12 · Diego (con Claude Code) · Tareas: F4-05 (corrida base), F4-06 (iteración 1 de calibración)

## Comprensión
El set dorado de 34 casos (`evals/chat-golden.jsonl`) estaba validado y probado con mocks, pero nunca había corrido contra
el Worker real. Antes de la corrida hubo que dejar el Worker en `AI_MODE=live` y cambiar el modelo por defecto a
Haiku 5.5 (ver «Construcción»). En la app, una pregunta de resumen («Resume lo más importante de hoy») respondía «No
encontré noticias publicadas sobre eso», aunque el digest había funcionado antes con Haiku 4.5.

## Hipótesis
El digest fallaba porque `CHAT_MAX_TOKENS = 700` se quedó corto con Haiku 5.5: el tokenizador cuenta cerca de 30 % más
de tokens por el mismo texto (guía de migración de Anthropic) y el modelo piensa un poco antes de responder. Con hasta
4 bloques, el JSON se cortaba, la validación fallaba dos veces y el digest no se generaba. Entonces el chat caía al flujo
normal, que no encontraba nada relevante y se abstenía. Subir el límite a 1500 debía eliminar las falsas abstenciones de
tipo `resumen_region`.

Esta es una hipótesis: no se leyó la fila de error del ledger que confirme el truncamiento. La corrida v2 es la prueba
indirecta.

## Construcción
Cambios previos que hicieron posible la corrida (sin commit al momento de escribir este loop; hash pendiente):
- Modelo por defecto `claude-haiku-5-5` y su precio en `services/api/src/ai/pricing.ts` (USD 0.10 / 0.50 por MTok hasta
  100k tokens de prompt; 0.50 / 2.50 por encima).
- El proveedor dejó de enviar `temperature: 0`, que Haiku 5.5 rechaza con 400; usa `effort: low` en los modelos
  `claude-haiku-5*` (`providers/anthropic.ts`).
- El digest guardado solo se sirve si lo generó el mismo proveedor y modelo que la ruta actual (`digest.ts`); la
  caché del chat pasó a `cacheVersion: 'v3'`.
- Ruta `/` de la app móvil (`apps/mobile/app/index.tsx`) que redirige al chat.

Cambio que se mide en este loop (una sola variable): `CHAT_MAX_TOKENS` de 700 a 1500 en
`services/api/src/ai/prompts/chat.v1.ts`.

## Prueba y observación
Corrida base v1 (700 tokens), `evidence/evals/chat-20261013-0401.json`, 34 casos, `aiMode=live`, índice v13:

| Métrica | v1 (700 tokens) | v3 (1500 tokens, sin caché) | Objetivo |
|---|---|---|---|
| Modo esperado | 94.1 % (32/34) | 100 % (34/34) | — |
| Abstención correcta | 100 % (5/5) | 100 % (5/5) | ≥ 90 % |
| Falsas abstenciones | 7.7 % (2/26) | 0 % (0/26) | ≤ 15 % |
| Menciona incertidumbre | 100 % (7/7) | 100 % (7/7) | ≥ 90 % |
| Citas prohibidas | 0 | 0 | 0 |
| Fallos ante inyección | 0 | 0 | 0 |
| Precisión de citas | 88.9 % (24/27) | 85.7 % (24/28) | — |
| Cobertura | 95.7 % (22/23) | 95.7 % (22/23) | — |
| Errores | 0 | 0 | — |
| Costo total | USD 0.0070 | USD 0.0064 | — |
| Latencia p50 / p95 | 2510 / 7339 ms | 1765 / 4121 ms | — |

v3 es `evidence/evals/chat-20261013-0425.json` (índice v15, 3 respuestas de caché por preguntas repetidas dentro de la
misma corrida). La v2 (`chat-20261013-0409.json`) no se usa para comparar: 33 de 34 casos salieron de la caché de v1.

- En v1 las dos falsas abstenciones fueron q01 y q07, ambas `resumen_region`. En v2 y v3 q01, q02 y q07 salieron en modo
  `digest`.
- Costo de v1: USD 0.0070 (media USD 0.00021 por pregunta); latencia p50 / p95 de 2510 / 7339 ms (respuestas `answer`:
  p50 2586 ms; `abstain`: 624 ms). El tope de la tarea F4-05 era USD 0.15.
- **Límite de la comparación:** v2 corrió minutos después de v1 y salió casi toda de la caché (`cached = 33`, p50
  235 ms), así que solo midió los 3 casos de resumen. v3 se corrió después de que el índice cambiara (v13 → v15 por la
  prueba de inyección), lo que invalida la caché del chat; es la medición completa. Sigue siendo una corrida única.
- La precisión de citas bajó de 24/27 a 24/28 porque v3 citó una noticia más (q15, `n-es-004`) que el set dorado no
  esperaba; falta revisarla a mano, igual que las de los digests de q01, q02 y q07.
- Hubo una primera ejecución de v2 (`chat-20261013-0408.json`) con 34 errores y 0 respuestas, antes de la que sirve;
  la causa no se registró. Se conserva como evidencia del intento fallido y no cuenta como medición.
- Las citas «dudosas» de q01, q02 y q07 son las del digest (3 a 5 noticias cada uno) frente a las esperadas del set
  dorado; falta revisarlas a mano, igual que las de q04, q06 y q10 y la noticia que falta en q09 (`n-mx-001`).

## Corrección / decisión
- Se conserva `CHAT_MAX_TOKENS = 1500`. Solo se cobran los tokens usados, así que el costo apenas cambia.
- Los objetivos de F4-06 se cumplen desde la corrida base; la calibración de τ, top-k y extracto queda sin tocar.
  F4-06 sigue ☐ hasta tener 2 iteraciones con una sola variable y su antes/después; esta es la primera.
- Pendiente: revisar a mano las citas dudosas y registrar la segunda iteración (una variable distinta).
- Sin ADR: no cambia una decisión de arquitectura.

## Rol de la IA en este loop
Claude Code propuso la causa del fallo del digest (límite de tokens con el tokenizador nuevo) y el cambio a 1500. Esa
causa es una hipótesis, no un hallazgo confirmado. Antes de llegar a ella se equivocó dos veces en la diagnosis: primero
atribuyó el «haiku-4-5» que seguía apareciendo en la pantalla a un despliegue pendiente o a la caché del chat, cuando era
un digest guardado cuya validez no dependía del modelo; después dio por resuelto el fallo con `temperature` y el
digest guardado, y el siguiente síntoma («solo respuestas mock») resultó ser un error de tipeo del usuario al
desplegar (`AI_MODE:liv`), que el Worker no valida. Se detectó al ver `aiMode` en `/health` y en la página `/indice`.
Se aceptó cambiar el digest para que valide proveedor y modelo, y la subida de `cacheVersion`. Quedó rechazada, por
fuera de alcance, la idea de que el Worker rechace valores inválidos de `AI_MODE`; queda como propuesta.
