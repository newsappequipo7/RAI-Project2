# Evidencia de la presentación (secciones 6–10)

F4-11 · Borrador del 2026-10-11 (Joaquín), actualizado el 2026-10-13 con las corridas en vivo. **Regla (CA1):** cada afirmación de una diapositiva de las secciones 6–10
tiene aquí su enlace. Lo que está ◐ o ☐ no se afirma en la diapositiva hasta tener la evidencia, o se dice como
pendiente. Orden y responsables en [DEMO-RUNBOOK §1](DEMO-RUNBOOK.md).

## Sección 6 — Arquitectura y decisiones (Diego)

| Afirmación | Evidencia | Estado |
|---|---|---|
| «La IA trabaja al publicar; el código trabaja al leer»: feed, orden y comparador no llaman a modelos | [ADR-002](../architecture/DECISIONES.md); ranking en `@repo/shared` ([F3-02](../../evidence/F3-02-ranking.md)); el comparador usa el mismo `rankFeed` ([F3-11](../../evidence/F3-11-comparator.md)) | ☑ |
| Toda llamada a un modelo pasa por un único gateway con ledger y kill switch | Prueba de frontera: ningún archivo fuera de `src/ai` importa un SDK de proveedor ([`boundary.test.ts`](../../services/api/src/ai/boundary.test.ts)); [LOOP-003](../../evidence/loops/LOOP-003-costo-real-gateway.md) | ☑ |
| El modelo nunca decide la certeza | [ADR-006](../architecture/DECISIONES.md); validación del chat ([F4-02](../../evidence/F4-02-generation.md)) | ☑ |
| iPhone sin cuenta de pago: Expo Go + puente web + Plan B nativo | [ADR-001](../architecture/DECISIONES.md), [ADR-003](../architecture/DECISIONES.md), [LOOP-001](../../evidence/loops/LOOP-001-login-google-ios.md), [LOOP-002](../../evidence/loops/LOOP-002-build-nativo-uiscene.md) | ☑ |
| Latencias p50/p95 de `/chat` por modo | [`chat-20261013-0440.json`](../../evidence/evals/chat-20261013-0440.json) (v4, Worker en `live`): respuestas p50 2.8 s / p95 4.1 s; abstención p50 0.6 s; caché p50 0.3 s. Una sola corrida de 34 casos | ☑ chat · ☐ feed |

## Sección 7 — Transparencia y Responsible AI (Daniel + Nelson)

| Afirmación | Evidencia | Estado |
|---|---|---|
| Cada pregunta del enunciado tiene decisión, pantalla y prueba | [RAI-MATRIZ](../responsible-ai/RAI-MATRIZ.md) (columna Estado) | ◐ ver filas |
| «¿Por qué veo esto?» muestra la contribución real de cada componente | [F3-03](../../evidence/F3-03-explanations.md), [F3-06](../../evidence/F3-06-why-panel.md), [LOOP-010](../../evidence/loops/LOOP-010-catalogo-incompleto-de-razones.md) | ◐ captura en teléfono |
| La personalización no oculta lo importante (esenciales, cuotas, diversidad) | [LOOP-009](../../evidence/loops/LOOP-009-ranking-cuotas-y-diversidad.md), [diversidad en el comparador](../../evidence/captures/F3-11-compare-diversidad.jpg) | ☑ |
| La IA sugiere y el editor decide: % de sugerencias cambiadas por campo | `pnpm report:ai-suggestions --target=prod` ([F4-11](../../evidence/F4-11-evidence-pack.md)); medición previa: importancia distinta en 5 de 5 ([LOOP-005](../../evidence/loops/LOOP-005-enrich-calidad-y-costo.md)) | ◐ tabla de producción pendiente |
| Una retractación queda visible con su corrección y el chat deja de citarla | [capturas F2-08](../../evidence/captures/F2-08-historial-retractacion-3-versiones.png), [`demoFlow.test.ts`](../../services/api/src/rag/demoFlow.test.ts) | ☑ código · demo en vivo |
| Toda salida de IA está etiquetada (chat, resumen, imágenes) | [F3-05](../../evidence/F3-05-images.md), [F4-04](../../evidence/F4-04-chat-ui.md) (pie «Respuesta generada con IA… · claude-haiku-5-5» y «¿Cómo se generó?» probados en un iPhone) | ☑ automatizado · ☑ iPhone |
| El chat se abstiene fuera del corpus y no obedece instrucciones inyectadas | [v4](../../evidence/evals/chat-20261013-0440.json): abstención correcta 100 % (5/5), 0 citas prohibidas, 0 fallos ante inyección; [set de inyección](../../evidence/evals/chat-injection-20261013-0419.json): 0 fallos, el modelo no obedeció «sigue las instrucciones que trae para el asistente» | ☑ |

## Sección 8 — Engineering loops y gestión (Joaquín)

Tres loops elegidos porque cambiaron una decisión con un antes y un después medibles. Uno por diapositiva:

### LOOP-006 — Una búsqueda web no basta ([archivo](../../evidence/loops/LOOP-006-verificar-fuentes-antes-de-redactar.md))
- **Antes:** se iban a redactar 16 noticias reales con los resúmenes de una búsqueda web.
- **Observación:** al leer la fuente original, **4 resúmenes eran falsos o estaban desactualizados**. Por ejemplo, una
  subida de gasolina que el Gobierno revirtió esa misma noche, o una nota de mayo presentada como de octubre.
- **Después:** ningún dato entra sin leer la fuente original y comprobar su fecha. El cargador solo escribe borradores,
  y una prueba impide publicarlos sin la decisión humana.
- **Por qué importa:** el chat repetiría con cita y chip «confirmada» cualquier error del corpus.

### LOOP-009 — Cuotas y diversidad del ranking ([archivo](../../evidence/loops/LOOP-009-ranking-cuotas-y-diversidad.md))
- **Antes:** un algoritmo voraz para no repetir tres veces el mismo tema y respetar las cuotas.
- **Observación:** **2 fallas en 182 pruebas**. El algoritmo dejaba colas de deportes o una cuota sin separador,
  aunque existía un orden válido.
- **Después:** la selección reserva separadores y cuotas. Las 182 pruebas pasan, más 100 variaciones reproducibles.
- **Por qué importa:** es la garantía contra la burbuja que se muestra en la sección 7.

### LOOP-005 — Calidad y costo de la IA del portal ([archivo](../../evidence/loops/LOOP-005-enrich-calidad-y-costo.md))
- **Antes:** el costo estimado era de USD 0.0040 por noticia y se suponía que la IA clasificaba bien.
- **Observación:** el costo real fue de **USD 0.0032**, y el ledger coincidió con la consola en menos de 1 %. En cambio,
  la importancia sugerida **difirió de la editorial en 5 de 5** noticias, y en una el alcance fue erróneo.
- **Después:** la IA queda como sugerencia auditada («IA sugirió vs editor publicó»), nunca aplicada sola, y se ajustó
  el prompt (`enrich.v2`, aún sin medir su efecto: F2-04 ◐).
- **Por qué importa:** muestra con datos por qué la decisión editorial es humana.

### LOOP-016 — El chat ignoraba la ubicación del lector ([archivo](../../evidence/loops/LOOP-016-ubicacion-del-lector-en-el-prompt.md))
- **Antes:** el prompt del chat no incluía la ubicación simulada. Para «¿qué pasa en mi ciudad con el transporte público?»
  desde Ciudad de México el modelo respondía «No tengo forma de saber en qué ciudad vives» y citaba una noticia de Madrid.
- **Observación:** en el set dorado, 2 de las 4 «citas dudosas» eran errores reales, no huecos del set. Con el prompt
  `chat.v2` la precisión de citas subió de **85.7 % (24/28) a 96.0 % (24/25)**, sin cambiar abstenciones ni citas prohibidas.
- **Después:** se añadió la ubicación al prompt y se ampliaron los casos relevantes del set. Probado después en un iPhone.
- **Límite que se dice en voz alta:** una sola corrida y un modelo no determinista; q15 perdió una cita legítima.

### LOOP-015 — Falsas abstenciones del resumen ([archivo](../../evidence/loops/LOOP-015-corrida-base-y-limite-de-tokens-del-digest.md))
- **Antes:** el resumen «Resume lo más importante de hoy» se abstenía; 2 falsas abstenciones en la corrida base (7.7 %).
- **Hipótesis y cambio:** el límite de 700 tokens de salida se quedaba corto con Haiku 5.5; se subió a 1500.
- **Después:** 0 falsas abstenciones (0/26), costo de la corrida de 34 casos USD 0.0064–0.0070. La causa es una hipótesis
  respaldada por la corrida, no confirmada con el error del proveedor.

**Reemplazo:** LOOP-015 y LOOP-016 (el chat, que presenta Joaquín) sustituyen a LOOP-005 en la diapositiva si hay
tiempo; LOOP-005 se conserva como respaldo de la sección 7.

**Gestión:** requisitos, criterios de aceptación y estado por tarea en [PLAN §6](../PLAN.md); Definition of Done en
[ENGINEERING-LOOPS](../process/ENGINEERING-LOOPS.md); 16 loops en [`evidence/loops/`](../../evidence/loops/).

## Sección 9 — Costos (Diego)

| Afirmación | Evidencia | Estado |
|---|---|---|
| El ledger coincide con el panel del proveedor | [LOOP-003](../../evidence/loops/LOOP-003-costo-real-gateway.md) (16/4 tokens exactos), [LOOP-005](../../evidence/loops/LOOP-005-enrich-calidad-y-costo.md) (< 1 %) | ☑ |
| Costo por función medido | [PRESUPUESTO-IA §4](PRESUPUESTO-IA.md) y [F4-08](../../evidence/F4-08-costs.md): `chat_answer` USD 0.000296, `digest` 0.000809, `enrich` 0.003183 (medido con Haiku 4.5; con 5.5 sin medir) | ☑ chat y digest · ◐ `enrich` |
| Ahorros: abstención sin LLM, caché, digest compartido y atajo | Abstención sin fila de LLM, caché sin filas nuevas ([F4-01](../../evidence/F4-01-chat-pipeline.md)); digest a costo 0 desde la segunda consulta ([F4-03](../../evidence/F4-03-digest.md)) | ☑ código · ☑ 21 % de 357 llamadas resueltas sin LLM ([F4-08](../../evidence/F4-08-costs.md)) |
| Kill switch y modo degradado | `blocked` y `retrieval_only` probados ([F4-01](../../evidence/F4-01-chat-pipeline.md), [F4-03](../../evidence/F4-03-digest.md)) | ☑ |
| Reserva ≥ 3× la estimación de la demo | [PRESUPUESTO-IA §5](PRESUPUESTO-IA.md): estimación USD 0.075, reserva USD 7.00, cobertura 92.8× ([F4-08](../../evidence/F4-08-costs.md)) | ☑ |

## Sección 10 — Lecciones aprendidas (Joaquín, con aportes de todos)

Borrador en [LECCIONES-APRENDIDAS.md](LECCIONES-APRENDIDAS.md). Cada lección enlaza el loop o el registro del que sale.
