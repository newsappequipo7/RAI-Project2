# Lecciones aprendidas (borrador)

F4-11 · Borrador del 2026-10-11 redactado por Joaquín a partir de los loops, handoffs y registros de evidencia.
**Cada persona debe confirmar o corregir lo que se le atribuye** antes de la sección 10. Lo marcado «propuesta» se
extrajo de sus loops y todavía no fue validado por esa persona.

## Supuestos que cambiaron

| Supuesto inicial | Lo que observamos | Evidencia | Aporte de |
|---|---|---|---|
| Firebase Auth resolvía Google en Expo Go con el flujo estándar | En iPhone hizo falta abrir Safari completo con un puente web propio | [LOOP-001](../../evidence/loops/LOOP-001-login-google-ios.md) | Diego (propuesta) |
| Los resúmenes de una búsqueda web bastan para redactar noticias reales | 4 de los resúmenes eran falsos o estaban desactualizados; hay que leer la fuente original | [LOOP-006](../../evidence/loops/LOOP-006-verificar-fuentes-antes-de-redactar.md) | Daniel (propuesta) |
| Un algoritmo voraz alcanza para garantizar cuotas y diversidad | Fallaba en casos de borde; hubo que reservar separadores | [LOOP-009](../../evidence/loops/LOOP-009-ranking-cuotas-y-diversidad.md) | Nelson (propuesta) |
| La IA puede clasificar la importancia de una noticia | Difirió del editor en 5 de 5 noticias | [LOOP-005](../../evidence/loops/LOOP-005-enrich-calidad-y-costo.md) | Diego (propuesta) |
| Al publicar hay que invalidar todos los digests | Se puede saber cuáles cambian con el mismo código que los elige; así los demás siguen gratis | [F4-03](../../evidence/F4-03-digest.md) | Joaquín |
| Con un handoff completo, la siguiente persona puede arrancar sola | Al seguir solo el handoff de F3 en un clon limpio faltaron Java 21+ y `firebase-tools`, y el trabajo previo de F4 (`intent.ts`, `evals/`) no existía | [Recorrido F3](../../evidence/F3-handoff-walkthrough.md), [F4-01](../../evidence/F4-01-chat-pipeline.md) | Joaquín |
| Un corpus semilla con fechas relativas sirve para la demo | Con la ventana de 72 h, al día siguiente de escribir la semilla solo 24 de 41 noticias entraban al feed | [Recorrido F3](../../evidence/F3-handoff-walkthrough.md) §2, [F4-09](../../evidence/F4-09-demo-readiness.md) | Joaquín |

## Límites que quedan

- **El chat no juzga su propio texto:** el código impide citas fuera de las noticias recuperadas y la filtración del
  prompt, pero no que el modelo diga algo falso que le pidió una inyección. Eso solo lo mide el set dorado
  ([F4-07](../../evidence/F4-07-injection.md)).
- **Los embeddings simulados no prueban relevancia:** con `AI_MODE=mock`, toda pregunta natural se abstiene. La
  calidad real del chat depende de las corridas en vivo ([F4-05](../../evidence/F4-05-golden-set.md)).
- **La evidencia en teléfono es menor que la automatizada:** varias tareas de F3 y F4 siguen en ◐ por falta de
  capturas o tiempos medidos en dispositivos ([PLAN §6](../PLAN.md)).
- **Silenciar un tema solo actúa si hay alternativas:** con pocas noticias en la ventana, el perfil «política
  silenciada» ordena igual que el perfil neutro ([recorrido](../../evidence/F3-handoff-walkthrough.md) §2).
- Variaciones regionales del español y preguntas largas no se evaluaron a fondo ([RAI-MATRIZ](../responsible-ai/RAI-MATRIZ.md)).

## Qué haríamos distinto

- Escribir antes el trabajo previo que otra fase da por hecho y verificarlo en el handoff (Joaquín).
- Definir desde la fase 1 un corpus de demo con fechas absolutas y un refresco automático (Joaquín).
- Medir en teléfono al cerrar cada tarea, no al final de la fase (pendiente: aporte de Nelson).
- Pendiente: aportes de Diego y Daniel.
