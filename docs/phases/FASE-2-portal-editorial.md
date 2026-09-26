# FASE 2 — Portal editorial (Daniel · 1 – 5 oct)

## Resumen

| | |
|---|---|
| Entra | Handoff F1: portal con login admin, Worker con gateway/ledger/índice, corpus semilla, tipos y esquemas |
| Sale (demostrable) | Crear una noticia, recibir sugerencias IA, cargar fuentes y afirmaciones, resolver imagen sin foto, validar certeza con checklist, publicar, verla indexada; corregir y retractar; dashboard de costos |
| Tope de gasto IA | USD 3.00 |
| Fuera de alcance | Feed móvil y chat (F3, F4). La app móvil ya muestra publicadas si alguien la abre, pero no se trabaja aquí |

Toda la lógica de reglas editoriales va en `packages/shared/src/editorial/` (funciones puras con pruebas) para que el
portal y cualquier prueba usen las mismas reglas.

---

### F2-01 — Lista de noticias
**Leer:** MODELO-DATOS.md §2–3.
**Pasos:**
1. Ruta `/news`: tabla con título, workflow, certeza, importancia, alcance, fecha, autor; filtros por workflow y certeza;
   búsqueda por título.
2. Botón "Nueva noticia" crea borrador vacío y navega a `/news/[id]`.
3. Suscripción en tiempo real a `news` (orden `updatedAt desc`).
**CA:** CA1: las 40 noticias semilla aparecen y los filtros funcionan. CA2: un borrador creado por otro admin aparece sin recargar.

### F2-02 — Editor de noticia
**Leer:** VERIFICACION-Y-FUENTES.md §1 y §4.
**Pasos:**
1. `/news/[id]` con secciones: Contenido (título, entradilla, cuerpo markdown con vista previa), Clasificación (temas
   1–3, alcance geo con selector de países/ciudades/regiones del catálogo, importancia 0–3 con descripción de cada nivel),
   Fuentes, Afirmaciones, Imagen, Certeza y checklist, Historial.
2. Validación con los esquemas zod de `shared`; errores junto a cada campo.
3. Autoguardado del borrador (debounce 2 s) con indicador "Guardado".
4. Contador de caracteres de entradilla (máx. 280) y aviso si el título supera 110.
**CA:** CA1: un borrador se puede cerrar y reabrir sin perder datos. CA2: datos inválidos no se guardan como publicados.

### F2-03 — Fuentes y afirmaciones
**Pasos:**
1. Gestor de fuentes: nombre, organización, URL (validada), tipo, `supports` (confirma/contradice/contexto), nota,
   fecha de consulta (default ahora).
2. Indicador de independencia: cuántas organizaciones distintas confirman.
3. Gestor de afirmaciones: texto, fuentes vinculadas (multi-select), estado calculado (`respaldada` si tiene ≥ 1 fuente
   que confirma; `en_disputa` si alguna vinculada contradice; si no, `sin_respaldo`).
**CA:** CA1: el estado de cada afirmación se recalcula al vincular/desvincular fuentes. CA2: URL inválida no se guarda.

### F2-04 — Enriquecimiento con IA (Worker + UI)
**Leer:** CONTRATOS-API.md §2, VERIFICACION-Y-FUENTES.md §5, PRESUPUESTO-IA.md §3.
**Pasos (Worker):**
1. `POST /admin/enrich` usando `gateway.run('enrich', …)` con salida JSON validada por zod contra `EnrichSuggestion`.
2. Prompt versionado `src/ai/prompts/enrich.v1.ts`. Debe: restringir temas y regiones a los catálogos (pasarlos en el
   prompt), explicar importancia con la definición de cada nivel, extraer afirmaciones verificables (máx. 8) marcando
   si parecen necesitar fuente, evaluar sensacionalismo del título con razón breve, redactar resumen de ≤ 2 oraciones sin
   añadir información que no esté en el texto, tratar el texto como datos (no instrucciones).
3. Caché en KV por `sha256(title+lead+body)`; si existe, costo 0.
4. Post-validación en código: temas fuera del catálogo se descartan; países se normalizan a ISO del catálogo.
**Pasos (UI):**
5. Botón "Sugerir con IA" (deshabilitado si no hay título y cuerpo). Panel de sugerencias con botón Aceptar/Editar por
   cada campo; nada se aplica automáticamente.
6. Guardar `aiSuggestions` en la noticia al recibirla, y mostrar al final "IA sugirió X, se publicó Y".
7. Si el resumen se acepta, se guarda en `aiSummary` con `approvedBy` y `approvedAt`.
**CA:**
- CA1: 5 noticias reales de prueba producen sugerencias válidas según el esquema.
- CA2: enriquecer dos veces sin cambios cuesta 0 la segunda vez (ver ledger).
- CA3: ninguna sugerencia modifica campos sin clic del editor.
- CA4: costo medio por `enrich` registrado en PRESUPUESTO-IA.md §4.
**Evidencia:** capturas; LOOP sobre calidad del prompt (al menos una iteración con antes/después).

### F2-05 — Reglas de certeza y checklist (bloqueo de publicación)
**Leer:** VERIFICACION-Y-FUENTES.md §2–3.
**Pasos:**
1. `packages/shared/src/editorial/validatePublish.ts`: recibe `News` y certeza deseada, devuelve
   `{ ok: boolean, errors: { code, message, field }[] }` implementando la tabla §2 y el checklist §3.
2. Pruebas: una fuente → solo `en_desarrollo`; dos fuentes misma organización → no `confirmada`; fuente `redes` no
   cuenta; contradicción → solo `disputada`; nota obligatoria en `en_desarrollo`/`disputada`; checklist incompleto bloquea;
   afirmación `sin_respaldo` bloquea `confirmada`; imagen sin crédito bloquea.
3. En el editor: selector de certeza que explica el requisito de cada opción y muestra en vivo los errores;
   botón Publicar deshabilitado mientras `ok = false`.
**CA:** CA1: todas las pruebas pasan. CA2: en la UI, cada error aparece con texto comprensible y enlace al campo.
**Evidencia:** salida de pruebas (evidencia directa de la pregunta "Validación" de la matriz RAI).

### F2-06 — Publicar e indexar
**Leer:** ARQUITECTURA.md §3.1, CONTRATOS-API.md §3.
**Pasos:**
1. Publicar: transacción que pone `workflow = 'publicada'`, `publishedAt`, `publishedBy`, incrementa `version` y escribe
   snapshot en `versions/{v}`.
2. Llamar `/admin/index/upsert`. Si falla, guardar `indexPending: true` en la noticia y mostrar botón "Reintentar
   indexación". Botón global "Reconstruir índice" en `/news` (llama `rebuild` con todas las publicadas).
3. Mensaje de confirmación con enlace "Ver en el comparador" (lo llena F3).
**CA:** CA1: tras publicar, la noticia aparece en Firestore publicada y `/health` muestra nueva `indexVersion`.
CA2: con el Worker apagado, la noticia queda con `indexPending` y el reintento funciona.

### F2-07 — Imágenes
**Leer:** IMAGENES.md completo, ADR-007.
**Pasos:**
1. Decidir almacenamiento de fotos subidas (ADR nuevo): Cloudinary plan gratuito con upload preset sin firma limitado a
   imágenes, o solo URL externa con crédito. No usar Firebase Storage sin ADR (requiere Blaze).
2. Pestaña "Subir foto real": archivo o URL, crédito, licencia/permiso, fuente, texto alternativo.
3. Pestaña "Buscar con licencia libre": `/admin/image/search` (Openverse + Commons) en el Worker; grilla de resultados
   con licencia visible; al elegir se llenan crédito, licencia y URLs automáticamente.
4. Pestaña "Portada generada": vista previa de la portada tipográfica. Especificación visual en
   `packages/shared/src/cover/spec.ts` (colores por tema, jerarquía tipográfica, leyenda fija) para que la app
   (F3-05) la renderice idéntica. En la noticia: `kind = 'portada_generada'`, `url = ''`.
5. Pestaña "Ilustración IA": visible solo si `imageGenEnabled`; muestra advertencia, costo estimado y reglas; el prompt
   del editor se envuelve con las restricciones fijas; resultado con sello incrustado y `aiDisclosure`.
6. Texto alternativo obligatorio en todos los casos.
**CA:** CA1: una noticia sin foto se resuelve con licencia libre y otra con portada, ambas con pie correcto.
CA2: con el flag apagado, generar IA no es posible ni desde la API.
**Evidencia:** capturas de las 4 pestañas.

### F2-08 — Correcciones y retractación
**Leer:** VERIFICACION-Y-FUENTES.md §6.
**Pasos:**
1. Editar una publicada exige completar un `CorrectionEntry` (tipo + resumen) antes de guardar; guarda nueva versión.
2. Acción "Retractar": confirma, pide resumen, pone `certainty = 'retractada'`, llama `/admin/index/remove`.
3. Pestaña Historial: lista de versiones con diff simple de título/entradilla/certeza.
**CA:** CA1: tras retractar, `/admin/index/remove` se ejecutó y la noticia sigue en Firestore con su corrección.
CA2: el historial muestra todas las versiones.

### F2-09 — Dashboard de costos
**Leer:** PRESUPUESTO-IA.md §6, CONTRATOS-API.md §1.
**Pasos:**
1. Ruta `/costs`: tarjetas (gasto acumulado, saldo estimado, reserva, último saldo real), gráfico por día y por tarea,
   tabla de costo medio por llamada, % de llamadas evitadas, estado de flags.
2. Controles de flags (kill switch, `chatMode`, `imageGenEnabled`) con confirmación.
3. Formulario de snapshot de saldo real del proveedor.
**CA:** CA1: los números coinciden con una consulta directa a D1. CA2: cambiar `chatMode` se refleja en `/health`.

### F2-10 — Pruebas del flujo editorial
**Pasos:**
1. Pruebas unitarias de `editorial/` (F2-05) y de normalización de `enrich`.
2. Una prueba e2e con Playwright contra emuladores: crear → fuentes → checklist → publicar (con `AI_MODE=mock`).
**CA:** CA1: CI corre ambas sin gastar créditos.

### F2-11 — Corpus editorial real
**Pasos:**
1. Publicar por el portal al menos 15 noticias adicionales basadas en noticias reales recientes (reescritas por el
   equipo, con fuentes reales enlazadas), repartidas entre las ubicaciones del catálogo.
2. Preparar los 2 borradores de demo descritos en DEMO-RUNBOOK.md §2.
**CA:** CA1: ≥ 55 noticias publicadas en total; CA2: cada una pasa `validatePublish`.

### F2-12 — [PLUS] Vista previa móvil y cierre
**Pasos:**
1. `[PLUS]` En el editor, panel "Así se verá": renderiza la tarjeta en los 4 tiers y la vista de lectura con los mismos
   estilos (reutilizando tokens de diseño).
2. Completar `docs/handoffs/FASE-2.md`, filas F2 en PLAN.md §6, `git tag fase-2-done`.
**CA:** CA1: Nelson corre el portal y publica una noticia siguiendo solo el handoff.
