# LOOP-016 — El chat ignoraba la ubicación simulada del lector
2026-10-12 · Diego (con Claude Code) · Tareas: F4-06 (iteración 2 de calibración), F4-05 (ajuste del set dorado)

## Comprensión
En la corrida v3 ([LOOP-015](LOOP-015-corrida-base-y-limite-de-tokens-del-digest.md)), q04 («¿Hay algún festival en mi
ciudad?», Quetzaltenango) y q06 («¿Qué pasa en mi ciudad con el transporte público?», CDMX) respondían que el modelo
no sabía en qué ciudad vivía el lector, y además citaban noticias de otro lugar (`n-us-003`, cine en Nueva York;
`n-es-003`, autobuses en Madrid). La ubicación es lo que el usuario elige en la app y el feed la usa; el prompt del chat
(`chat.v1`) no la incluía.

## Hipótesis
Si el prompt incluye la ubicación simulada del lector y una regla para «mi ciudad / mi zona / mi país», el modelo dejará
de decir que no sabe dónde vive y dejará de citar noticias de otros lugares para esa parte de la pregunta. Una sola
variable: el prompt (`chat.v1` → `chat.v2`); modelo, umbral τ, top-k y extracto no cambian.

## Construcción
- Commit `a75961b`: `<ubicacion_lector>` antes de `<noticias>` y una regla nueva en el prompt de sistema
  (`services/api/src/ai/prompts/chat.v2.ts`). El texto sale del catálogo de ubicaciones (`describeLocation`), no del
  texto del usuario, y se neutraliza como el resto del contexto. Lo reutiliza el digest.
- `CHAT_PROMPT_VERSION = 'chat.v2'`: forma parte de la clave de caché, así que no se sirven respuestas del prompt anterior.
- Pruebas: 220 en el Worker, tres nuevas del prompt (ubicación presente, neutralizada y ausente).

## Prueba y observación
Corrida v4 (`evidence/evals/chat-20261013-0440.json`, índice v15, `aiMode=live`, 3 respuestas de caché por preguntas
repetidas) frente a v3 (`chat-20261013-0425.json`, mismo índice), con el set dorado sin cambios:

| Métrica | v3 (`chat.v1`) | v4 (`chat.v2`) | Objetivo |
|---|---|---|---|
| Modo esperado | 100 % (34/34) | 100 % (34/34) | — |
| Precisión de citas | 85.7 % (24/28) | 96.0 % (24/25) | — |
| Cobertura | 95.7 % (22/23) | 95.7 % (22/23) | — |
| Abstención correcta | 100 % (5/5) | 100 % (5/5) | ≥ 90 % |
| Falsas abstenciones | 0 % (0/26) | 0 % (0/26) | ≤ 15 % |
| Menciona incertidumbre | 100 % (7/7) | 100 % (7/7) | ≥ 90 % |
| Citas prohibidas / fallos de inyección | 0 / 0 | 0 / 0 | 0 |
| Costo total | USD 0.0064 | USD 0.0071 | — |
| Latencia p50 / p95 | 1765 / 4121 ms | 1749 / 4085 ms | — |

Lo que cambió en las respuestas (leído del JSON):
- **q04:** v3 decía que no podía saber la ciudad y citaba `n-gt-003` y `n-us-003`. v4 responde «Sí, en Quetzaltenango se
  celebra el festival de marimba…» y cita solo `n-gt-003`.
- **q06:** v3 decía «No tengo forma de saber en qué ciudad vives» y citaba `n-mx-003` y `n-es-003`. v4 responde sobre la
  línea de transporte de la Ciudad de México y cita solo `n-mx-003`.
- **q15:** v4 dejó de citar `n-es-004` (campaña de vacunación contra la gripe), una noticia relevante; la respuesta quedó
  más corta. Es un efecto colateral no buscado: la precisión sube en parte porque hay menos citas (25 frente a 28), y de
  esas tres menos, dos eran errores reales (q04, q06) y una era legítima (q15).
- **q09 sigue sin citar `n-mx-001`:** no depende del prompt. Puntajes 0.463 / 0.431 / 0.416 con τ = 0.45; solo pasa el
  primero. No se tocó τ porque q31, que debe abstenerse, tiene un puntaje máximo de 0.437.

**Ajuste del set dorado (hecho después de medir v4, para no mezclar dos variables):** se añadió `relevant` a q10
(`n-ar-002`), q15 (`n-es-004`) y a los tres resúmenes q01, q02 y q07 con las noticias que el digest cita y que son de la
zona o del país (los de q01 y q02 de Guatemala; los de q07, tres de España y dos globales). Con el set nuevo se recalcularon
las tres corridas sobre sus respuestas guardadas (sin llamar al Worker; no incluye `forbidden`):

| Corrida | Precisión de citas con el set nuevo |
|---|---|
| v1 | 89.7 % (26/29) |
| v3 | 95.1 % (39/41) |
| v4 | 100 % (38/38) |

Las dos citas dudosas que quedan en v3 con el set nuevo son exactamente q04 y q06; v4 no tiene ninguna.

## Corrección / decisión
- Se conserva `chat.v2`. Sigue F4-06 con dos iteraciones registradas (LOOP-015: tokens; LOOP-016: prompt) y una sola
  variable en cada una.
- Un digest de q07 («noticias de mi país», Madrid) incluye dos noticias globales (`n-glo-001`, `n-glo-002`). Se aceptan en el
  set como relevantes, pero conviene saber si es lo que queremos mostrar; pendiente de decisión del equipo.
- Pendiente: q09/`n-mx-001` (umbral τ) y revisar a mano que la regla de ubicación no haga que el modelo afirme noticias de
  la zona cuando no las hay (probar «mi ciudad» en una ubicación sin noticias locales).
- Sin ADR: no cambia una decisión de arquitectura.

## Rol de la IA en este loop
Claude Code leyó las respuestas de v3 contra el set dorado y el prompt, y concluyó que dos de las cuatro «citas dudosas»
eran errores reales por la falta de ubicación en el prompt, no huecos del set; propuso la ubicación en el prompt y la regla.
No añadió `relevant` al set antes de medir v4 para mantener una sola variable, y recalculó las corridas guardadas después.
Se aceptó. Una limitación que él mismo señaló: sin `temperature` las respuestas ya no son deterministas, así que una corrida
no basta para afirmar que una cita desaparece siempre; q15 es un ejemplo de variación que no se puede atribuir al prompt.
