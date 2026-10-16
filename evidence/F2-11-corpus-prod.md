# F2-11 — Corpus editorial en producción (cierre, 2026-10-15)

Estado de la publicación del corpus editorial en Firestore de producción (`ai-news-app-f24cf`) y decisiones de revisión
humana. Fuente de los conteos: lectura directa de la colección `news` el 2026-10-15.

## Punto de partida (antes de las decisiones de hoy)

- 59 documentos: 43 con `workflow = publicada` (28 confirmadas, 9 en desarrollo, 3 disputadas, **3 retractadas**) y 16
  borradores.
- De las 18 piezas del corpus (16 editoriales + `demo-d1`, `demo-d2`), `ed-us-001` y `ed-us-002` ya se habían publicado
  desde el portal el 2026-10-14. Quedaban 14 editoriales y los 2 borradores de demo.
- `demo-d1` y `demo-d2` existen como borradores con fuentes cargadas (1 y 2 fuentes). No se publican: se publican en vivo
  en la demo (DEMO-RUNBOOK §2).

## Editoriales retenidas por revisión humana

Decisión de Diego (2026-10-15). Las tres pasan a `workflow = en_revision` en producción (cambio de un solo campo, con
precondición de `updateTime`, hecho el 2026-10-15). No se escribió texto libre en el documento: el modelo `News` no
tiene campo de nota interna, y `certaintyNote`, `Source.note` y `corrections` se muestran al lector al publicar. El
motivo vive en este archivo.

| ID | Motivo | Detalle |
|---|---|---|
| `ed-gt-004` | Vigencia del hecho | El desfile fue el 15 de septiembre; publicada hoy, el feed la trataría como reciente. Además solo una organización confirma (Soy502); la otra fuente es de contexto. Ver [LOOP-017](loops/LOOP-017-falta-de-fecha-del-hecho.md). |
| `ed-co-002` | Vigencia del hecho | Anuncia marchas «del 1 al 4 de octubre», redactadas en futuro y ya pasadas. Ver [LOOP-017](loops/LOOP-017-falta-de-fecha-del-hecho.md). |
| `ed-sv-001` | Fuente única sin confirmar | Una sola fuente (Diario El Salvador) para una cifra oficial («234 días sin homicidios»); no hay segunda organización que la confirme. |

## Editoriales publicadas el 2026-10-15

Diego abrió y revisó las fuentes de cada una antes de aprobarlas. Se publicaron con `publishedBy` = su uid, el checklist
marcado a partir de esa aprobación y `validatePublish` en verde (11 de 11) antes de escribir. Cada publicación fue un
commit atómico de Firestore con precondición de `updateTime` (`workflow`, `publishedAt`, `publishedBy`, `version`,
`updatedAt`, `checklist`) más el snapshot `versions/1`.

`ed-ar-001`, `ed-co-001`, `ed-es-001`, `ed-es-002`, `ed-es-003`, `ed-gt-001`, `ed-gt-002`, `ed-gt-003`, `ed-mx-001`,
`ed-sv-002`, `ed-sv-003`.

Indexado: un solo `POST /admin/index/upsert` con las 11 (`upserted: 11`), `indexVersion` 18 → **19**
(`/health` lo confirma); después se quitó `indexPending` de cada una. Verificación: la búsqueda semántica sin LLM
(`/admin/index/search`) por el título de cada noticia la devuelve en primer lugar, 11 de 11. Ningún documento queda con
`indexPending`.

## Criterio F2-11 CA1 (≥ 55 noticias publicadas)

**PARCIAL** — 3 editoriales retenidas por revisión humana (vigencia y fuentes).

- Publicadas con `workflow = publicada`: **53** (50 vigentes + **3 retractadas, visibles con su corrección**). Faltan 2
  para 55 si se cuentan las retractadas, y 5 si no.
- CA2 (cada una pasa `validatePublish`): cumple para las 11 publicadas hoy.

## Duplicado despublicado

`cGGXSnlvu0F9T6NVk7Vl` (publicado el 2026-10-09 por otro editor) era la misma noticia que `ed-us-001`. Se despublicó el
2026-10-15 con `workflow = rechazada`, un `CorrectionEntry` «Despublicada: duplicado de ed-us-001», `version` 2 y su
snapshot en `versions/2`. `POST /admin/index/remove` devolvió `removed: 0` (no estaba en el índice); `indexVersion` pasó
de 17 a 18. Detalle en [LOOP-018](loops/LOOP-018-duplicados-sin-deteccion.md).

## Conteo final de producción al 2026-10-15

| Estado | Cantidad |
|---|---|
| `publicada` | 53 (50 vigentes + **3 retractadas, visibles con su corrección**) |
| `borrador` | 2 (`demo-d1`, `demo-d2`; se publican en vivo en la demo) |
| `en_revision` | 3 (`ed-gt-004`, `ed-co-002`, `ed-sv-001`) |
| `rechazada` | 1 (`cGGX…`, duplicado) |
| Total de documentos | 59 |

`demo-d1` (1 fuente) y `demo-d2` (2 fuentes) siguen en `borrador` con sus fuentes cargadas. `n-ar-003`, la noticia
elegida para retractar en vivo, sigue publicada e indexada y es el primer resultado de su pregunta (0.647 frente a 0.271).
