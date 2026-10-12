# Evidencia de la presentación (secciones 6–10)

F4-11 · Borrador del 2026-10-11 (Joaquín). **Regla (CA1):** cada afirmación de una diapositiva de las secciones 6–10
tiene aquí su enlace. Lo que está ◐ o ☐ no se afirma en la diapositiva hasta tener la evidencia, o se dice como
pendiente. Orden y responsables en [DEMO-RUNBOOK §1](DEMO-RUNBOOK.md).

## Sección 6 — Arquitectura y decisiones (Diego)

| Afirmación | Evidencia | Estado |
|---|---|---|
| «La IA trabaja al publicar; el código trabaja al leer»: feed, orden y comparador no llaman a modelos | [ADR-002](../architecture/DECISIONES.md); ranking en `@repo/shared` ([F3-02](../../evidence/F3-02-ranking.md)); el comparador usa el mismo `rankFeed` ([F3-11](../../evidence/F3-11-comparator.md)) | ☑ |
| Toda llamada a un modelo pasa por un único gateway con ledger y kill switch | Prueba de frontera: ningún archivo fuera de `src/ai` importa un SDK de proveedor ([`boundary.test.ts`](../../services/api/src/ai/boundary.test.ts)); [LOOP-003](../../evidence/loops/LOOP-003-costo-real-gateway.md) | ☑ |
| El modelo nunca decide la certeza | [ADR-006](../architecture/DECISIONES.md); validación del chat ([F4-02](../../evidence/F4-02-generation.md)) | ☑ |
| iPhone sin cuenta de pago: Expo Go + puente web + Plan B nativo | [ADR-001](../architecture/DECISIONES.md), [ADR-003](../architecture/DECISIONES.md), [LOOP-001](../../evidence/loops/LOOP-001-login-google-ios.md), [LOOP-002](../../evidence/loops/LOOP-002-build-nativo-uiscene.md) | ☑ |
| Latencias p50/p95 de `/chat` por modo y del feed | F4-08 (Nelson) | ☐ |

## Sección 7 — Transparencia y Responsible AI (Daniel + Nelson)

| Afirmación | Evidencia | Estado |
|---|---|---|
| Cada pregunta del enunciado tiene decisión, pantalla y prueba | [RAI-MATRIZ](../responsible-ai/RAI-MATRIZ.md) (columna Estado) | ◐ ver filas |
| «¿Por qué veo esto?» muestra la contribución real de cada componente | [F3-03](../../evidence/F3-03-explanations.md), [F3-06](../../evidence/F3-06-why-panel.md), [LOOP-010](../../evidence/loops/LOOP-010-catalogo-incompleto-de-razones.md) | ◐ captura en teléfono |
| La personalización no oculta lo importante (esenciales, cuotas, diversidad) | [LOOP-009](../../evidence/loops/LOOP-009-ranking-cuotas-y-diversidad.md), [diversidad en el comparador](../../evidence/captures/F3-11-compare-diversidad.jpg) | ☑ |
| La IA sugiere y el editor decide: % de sugerencias cambiadas por campo | `pnpm report:ai-suggestions --target=prod` ([F4-11](../../evidence/F4-11-evidence-pack.md)); medición previa: importancia distinta en 5 de 5 ([LOOP-005](../../evidence/loops/LOOP-005-enrich-calidad-y-costo.md)) | ◐ tabla de producción pendiente |
| Una retractación queda visible con su corrección y el chat deja de citarla | [capturas F2-08](../../evidence/captures/F2-08-historial-retractacion-3-versiones.png), [`demoFlow.test.ts`](../../services/api/src/rag/demoFlow.test.ts) | ☑ código · demo en vivo |
| Toda salida de IA está etiquetada (chat, resumen, imágenes) | [F3-05](../../evidence/F3-05-images.md), [F4-04](../../evidence/F4-04-chat-ui.md) | ☑ automatizado |

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

**Reemplazo previsto:** si la calibración del chat (F4-06) produce sus 2 LOOPs con números, uno de ellos sustituye a
LOOP-005 en la diapositiva, porque muestra el chat, que es la parte que presenta Joaquín.

**Gestión:** requisitos, criterios de aceptación y estado por tarea en [PLAN §6](../PLAN.md); Definition of Done en
[ENGINEERING-LOOPS](../process/ENGINEERING-LOOPS.md); 14 loops en [`evidence/loops/`](../../evidence/loops/).

## Sección 9 — Costos (Diego)

| Afirmación | Evidencia | Estado |
|---|---|---|
| El ledger coincide con el panel del proveedor | [LOOP-003](../../evidence/loops/LOOP-003-costo-real-gateway.md) (16/4 tokens exactos), [LOOP-005](../../evidence/loops/LOOP-005-enrich-calidad-y-costo.md) (< 1 %) | ☑ |
| Costo por función medido | [PRESUPUESTO-IA §4](PRESUPUESTO-IA.md): `enrich` medido; `chat_answer` y `digest` por medir | ◐ F4-05/F4-08 |
| Ahorros: abstención sin LLM, caché, digest compartido y atajo | Abstención sin fila de LLM, caché sin filas nuevas ([F4-01](../../evidence/F4-01-chat-pipeline.md)); digest a costo 0 desde la segunda consulta ([F4-03](../../evidence/F4-03-digest.md)) | ☑ código · ◐ % real de llamadas evitadas |
| Kill switch y modo degradado | `blocked` y `retrieval_only` probados ([F4-01](../../evidence/F4-01-chat-pipeline.md), [F4-03](../../evidence/F4-03-digest.md)) | ☑ |
| Reserva ≥ 3× la estimación de la demo | [PRESUPUESTO-IA §5](PRESUPUESTO-IA.md), F4-08 | ☐ |

## Sección 10 — Lecciones aprendidas (Joaquín, con aportes de todos)

Borrador en [LECCIONES-APRENDIDAS.md](LECCIONES-APRENDIDAS.md). Cada lección enlaza el loop o el registro del que sale.
