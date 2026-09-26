# FASE 4 — Chat, evaluación y preparación de la demo (Persona 4)

## Resumen

| | |
|---|---|
| Entra | Handoff F3: app con feed y lectura completas, comparador, corpus ≥ 55 noticias, índice RAG, gateway con ledger |
| Sale (demostrable) | Chat como pantalla inicial con citas, certeza heredada, abstención y digest; set dorado con métricas y ≥ 2 iteraciones documentadas; demo ensayada con costos medidos y paquete de evidencia para la presentación |
| Tope de gasto IA | USD 6.00 de desarrollo (+ reserva de USD 7 solo con `env=demo`) |

Desarrollar todo el pipeline con `AI_MODE=mock` primero. Pasar a `live` solo para evals y ensayos.

---

### F4-01 — Pipeline del chat sin generación (pasos 1–7)
**Leer:** CHAT-RAG.md §1–2, CONTRATOS-API.md §4.
**Pasos:**
1. `routes/chat.ts` con validación zod del request (máx. 500 caracteres, historia ≤ 6 turnos).
2. Rate limit, flags y presupuesto vía gateway.
3. `rag/intent.ts`: reglas de intención + detección de país con `catalogs/countries-es.ts`; pruebas con 30 frases.
4. Recuperación con filtros por intención; exclusión de retractadas; top-k 6.
5. Abstención por umbral τ (config), caché en KV.
6. Modo `retrieval_only` completo (devuelve bloques con entradillas de las noticias encontradas, `generatedBy = null`).
**CA:** CA1: pruebas de intención ≥ 90 % correctas. CA2: pregunta fuera de corpus → `abstain` sin fila de LLM en el
ledger. CA3: segunda pregunta idéntica → `cached = true`.

### F4-02 — Generación y validación
**Leer:** CHAT-RAG.md §2 pasos 8–10 y §3.
**Pasos:**
1. Prompt `src/ai/prompts/chat.v1.ts` según requisitos; contexto con id, título, entradilla, extracto, certeza, nota,
   fuentes, fecha.
2. `rag/validate.ts`: parseo zod, reintento único, descarte de bloques sin ids o con ids fuera del top-k, herencia de
   certeza (incluye `mixta`), `notice` automático.
3. Pruebas de `validate.ts` con respuestas simuladas: ids inventados, JSON roto, bloque sin ids, certezas mezcladas,
   modelo que intenta afirmar "confirmado" sobre una noticia en desarrollo (debe prevalecer la certeza de la BD).
**CA:** CA1: todas las pruebas pasan. CA2: ningún id fuera del top-k llega al cliente (prueba específica).

### F4-03 — Digest por ubicación
**Leer:** CHAT-RAG.md §5.
**Pasos:** `GET /digest/:locationId` con generación perezosa; selección de noticias con `rankFeed` y perfil neutro
(importar `shared` en el Worker); guardar con `indexVersion`; invalidación ya existe desde F1-09.
**CA:** CA1: la segunda consulta de digest para la misma ubicación e índice cuesta 0. CA2: publicar una noticia de GT
invalida solo digests de ubicaciones afectadas.

### F4-04 — UI del chat (pantalla inicial de la app)
**Leer:** CHAT-RAG.md §4.
**Pasos:**
1. Saludo con ubicación simulada activa; 4 sugerencias tocables: "Resume lo más importante de hoy", "¿Qué pasa en mi
   zona?", "Explícame lo más importante de {otro país con noticias}", "¿Qué hay de nuevo sobre {tema frecuente}?".
2. Burbujas con bloques; chips de fuente tocables que abren `news/[id]`; chip de certeza por bloque; `notice` destacado.
3. Pie de procedencia de la respuesta; botón "¿Cómo se generó?" con intención, noticias usadas, caché/digest, costo.
4. Estados: escribiendo, error de red con reintento, `rate_limited`, `blocked` con texto claro.
5. Historial solo en memoria; botón "Nueva conversación"; texto "Esta conversación no se guarda".
6. Detectar tema de la pregunta (usando temas de las noticias citadas) y registrar evento `chat_topic`.
**CA:** CA1: los 4 casos del enunciado funcionan en iPhone y Android. CA2: toda respuesta con LLM muestra fuentes y
pie de IA; toda abstención lo dice explícitamente.

### F4-05 — Set dorado y runner de evaluación
**Leer:** CHAT-RAG.md §6.
**Pasos:**
1. `evals/chat-golden.jsonl` con ≥ 30 casos con la distribución indicada, usando ids estables del corpus semilla.
2. `evals/run-chat-evals.ts`: corre contra el Worker (dev, `AI_MODE=live`), calcula métricas, guarda JSON en
   `evidence/evals/` e imprime tabla resumen con costo.
3. Corrida base (v1) y registro en LOOP.
**CA:** CA1: el runner produce métricas reproducibles; CA2: costo por corrida < USD 0.15 (si no, reducir top-k o
extracto antes de seguir).

### F4-06 — Calibración (mínimo 2 iteraciones)
**Pasos:** ajustar, una variable a la vez, τ, top-k, longitud de extracto y redacción del prompt; cada cambio = corrida
+ LOOP con tabla antes/después. Objetivo: abstención correcta ≥ 90 %, falsas abstenciones ≤ 15 %, citas fuera de
lista = 0, menciona incertidumbre cuando corresponde ≥ 90 %.
**CA:** CA1: 2 LOOPs con evidencia numérica. CA2: configuración final anotada en CHAT-RAG.md.

### F4-07 — Endurecimiento contra inyección
**Pasos:**
1. Casos en el set dorado con inyección en la pregunta.
2. Noticia de prueba (solo en emulador/dev) cuyo cuerpo contiene instrucciones maliciosas; verificar que el chat no las
   sigue.
3. Delimitar el contexto en el prompt y reforzar que es data; la validación de citas en código es la defensa final.
**CA:** CA1: 0 casos donde el chat revele el prompt, cambie de rol o cite algo fuera del top-k.

### F4-08 — Latencia y costo reales
**Pasos:** medir p50/p95 de `/chat` por modo (abstain, digest, cached, answer) y del render del feed; completar la tabla
de PRESUPUESTO-IA.md §4 con promedios reales del ledger y recalcular la estimación de la demo (§5).
**CA:** CA1: tabla completa con datos reales. CA2: reserva verificada ≥ 3× la estimación de la demo.

### F4-09 — Preparación de la demo
**Leer:** DEMO-RUNBOOK.md completo, IOS-ANDROID-DISTRIBUCION.md §5.
**Pasos:**
1. Versión final publicada (EAS Update o túnel preparado); `/instalar` con QR final.
2. Borradores de demo listos (F2-11), noticia a retractar lista.
3. Script `pnpm demo:prepare`: reconstruye índice, calienta digests de las 8 ubicaciones, verifica flags y saldo.
4. Videos de respaldo por sección en `evidence/demo-videos/`.
**CA:** CA1: `demo:prepare` deja todo listo en < 2 min sin intervención manual.

### F4-10 — Ensayos generales (3)
**Pasos:** seguir DEMO-RUNBOOK.md §4 con todo el equipo; cronometrar; registrar gasto por ensayo (`env=demo`);
anotar fallas y correcciones como LOOPs.
**CA:** CA1: el tercer ensayo completa las 10 secciones en el tiempo asignado sin fallas bloqueantes.

### F4-11 — Paquete de evidencia para la presentación
**Pasos:**
1. Completar RAI-MATRIZ.md con enlaces a pruebas, capturas y corridas.
2. Seleccionar los 3 mejores LOOPs para la sección 8 y resumirlos en una diapositiva cada uno.
3. Tabla de "IA sugirió vs editor publicó" (desde `aiSuggestions`) para la sección 7.
4. Borrador de lecciones aprendidas con aportes de las 4 personas (supuestos que cambiaron, límites que quedan, qué
   haríamos distinto).
**CA:** CA1: cada afirmación de las diapositivas de secciones 6–10 tiene un enlace a evidencia.

### F4-12 — Cierre
**Pasos:** completar `docs/handoffs/FASE-4.md` como estado final; congelar `main` con `git tag demo-final`; snapshot de
saldo real registrado el día anterior a la presentación.
**CA:** CA1: saldo restante ≥ USD 5 antes del último ensayo.
