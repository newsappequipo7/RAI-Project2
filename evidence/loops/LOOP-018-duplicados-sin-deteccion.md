# LOOP-018 — Nadie detecta que dos noticias publicadas son la misma
2026-10-15 · Diego (con Claude Code) · Tareas: F2-11 (corpus editorial real), F2-05 (validación al publicar)

## Comprensión
Al comparar el estado de producción con el corpus editorial apareció el documento `cGGXSnlvu0F9T6NVk7Vl`, publicado el
2026-10-09 por otro editor desde el portal (id automático de Firestore), con el mismo título, las mismas tres fuentes
(Rent Guidelines Board, Infobae, La Opinión), las mismas tres afirmaciones, la misma certeza (`confirmada`), importancia,
geo e imagen que `ed-us-001`, que Diego publicó el 2026-10-14 desde el corpus. Era la misma noticia dos veces.

## Hipótesis
Nada en el flujo compara una noticia nueva con las ya publicadas: el seed del corpus solo mira si existe un documento con
el mismo `id`, y `validatePublish` valida los campos de una noticia, no su unicidad. Buscamos en el código
(`packages/shared`, `apps/admin`, `services/api`) cualquier detección de duplicados de noticias y no existe: las únicas
coincidencias son temas repetidos (`topics_duplicated`), la deduplicación de consultas del feed y la de eventos del perfil.

## Construcción
Comparación campo por campo de los dos documentos leídos de Firestore (solo lectura) y búsqueda de menciones en el repo y
en el set dorado. Las diferencias reales: ids, `createdAt`/`publishedAt`/`publishedBy`/`createdBy` y el cuerpo, que en
`cGGX…` trae los saltos de línea como texto literal `\n\n` y en `ed-us-001` como saltos reales. Solo `ed-us-001` está en
`docs/ops/CORPUS-EDITORIAL.md` y en `packages/shared/fixtures/editorial-corpus.json`; ninguna está en
`evals/chat-golden.jsonl` ni en el runbook.

## Prueba y observación
- Se conservó `ed-us-001` (trazada en el corpus, cuerpo bien formado) y se despublicó `cGGX…`: `workflow = rechazada`
  (no se retractó), `CorrectionEntry` `{kind: actualizacion, summary: «Despublicada: duplicado de ed-us-001»}`,
  `version` 1 → 2 y el snapshot en `versions/2`. Verificado releyendo ambos documentos.
- `POST /admin/index/remove` respondió `removed: 0` y subió `indexVersion` de 17 a 18: `cGGX…` **no estaba en el
  índice**. Dos búsquedas semánticas sobre la noticia (sin LLM) devuelven solo `ed-us-001` (0.717 y 0.644). Es decir, el
  chat nunca habría citado el duplicado; no pudimos saber por qué no estaba indexada.
- No medimos si los dos aparecían a la vez en el feed. Con la ventana de 72 h la del 9 de octubre ya estaba fuera cuando
  se publicó la del 14; si se amplía `feedWindowHours` para la demo ([ADR-013](../../docs/architecture/DECISIONES.md))
  habrían entrado las dos.

## Corrección / decisión
- Duplicado despublicado hoy a mano, con registro de auditoría en el propio documento.
- Trabajo futuro, sin hacerlo hoy: aviso en el portal al publicar si otra noticia publicada comparte dos o más URL de
  fuente o un título casi igual; y que `seed:editorial` compare también por URL de fuente y no solo por `id`.
- Limitación declarada: la unicidad de las noticias depende de la revisión humana.

## Rol de la IA en este loop
- Claude Code encontró el duplicado al listar los candidatos a retractar, comparó los documentos y recomendó cuál
  conservar; Diego aprobó el plan exacto antes de cualquier escritura.
- Errores de Claude Code: (1) el primer intento de `index/remove` usó `urllib` y Cloudflare lo bloqueó (HTTP 403, código
  1010, por el User-Agent); la escritura en Firestore ya se había hecho, así que el documento estuvo `rechazada` unos
  minutos antes de la llamada de índice; se vio en la salida del script y se repitió con `curl`; (2) se dio por hecho
  que el duplicado estaba indexado y no lo estaba (`removed: 0`).
- No se gastaron créditos de IA.
