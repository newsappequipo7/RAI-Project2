# Verificación, fuentes, procedencia y correcciones

## 1. Dos ejes independientes

- **Workflow** (proceso interno): `borrador → en_revision → publicada | rechazada`.
- **Certeza** (lo que ve el lector): `confirmada | en_desarrollo | disputada | retractada`.

Una noticia puede estar `publicada` y `en_desarrollo` a la vez. Eso es lo normal en noticias de última hora.

## 2. Reglas para asignar certeza (validadas en el portal, bloquean el botón Publicar)

| Certeza | Requisito mínimo | Qué ve el lector |
|---|---|---|
| `confirmada` | ≥ 2 fuentes con `supports = 'confirma'` de **organizaciones distintas**, al menos una `primaria` o `agencia`; todas las `claims` en `respaldada` | Chip verde "Confirmada · N fuentes" |
| `en_desarrollo` | ≥ 1 fuente que confirma; `certaintyNote` obligatoria ("Falta confirmar X") | Banner ámbar arriba del texto: "Información en desarrollo: {nota}" |
| `disputada` | ≥ 1 fuente `confirma` y ≥ 1 `contradice`; `certaintyNote` obligatoria describiendo ambas versiones | Banner naranja "Las fuentes no coinciden" + listado lado a lado |
| `retractada` | Solo desde una noticia ya publicada; entrada de corrección obligatoria | Banner rojo, texto tachado conservado, explicación visible; fuera del feed y del chat |

Fuente de tipo `redes` nunca cuenta como una de las dos fuentes para `confirmada`.

Qué pasa cuando…
- **Una sola fuente:** solo se puede publicar como `en_desarrollo`. El portal lo explica en el formulario.
- **Dos fuentes se contradicen:** solo `disputada`, o se deja en `en_revision` hasta resolver.
- **No está confirmada:** se publica como `en_desarrollo` con nota, o no se publica. Nunca como `confirmada`.

## 3. Checklist editorial (todas en `true` para publicar)

1. `fuentes_revisadas` — abrí cada enlace y la fuente dice lo que registré.
2. `afirmaciones_con_respaldo` — cada afirmación verificable tiene fuente o se eliminó.
3. `titulo_no_sensacionalista` — el título no exagera lo que dicen las fuentes (la IA puede marcar alerta; decide el editor).
4. `imagen_etiquetada` — tipo, crédito y licencia de la imagen están registrados.
5. `alcance_geo_revisado` — alcance y países corresponden a quién afecta la noticia.
6. `certeza_justificada` — la certeza elegida cumple la tabla de §2.

## 4. Procedencia del contenido (lo que distingue humano de IA)

| Origen | Dónde aparece | Etiqueta visible |
|---|---|---|
| `original_editorial` | Cuerpo de la noticia escrito por el editor | "Redacción: {nombre}" |
| `cita_fuente` | Citas textuales marcadas en el cuerpo con `>` | Nombre de la fuente enlazada |
| `resumen_ia` | Resumen corto sobre el cuerpo, solo si un editor lo aprobó | Chip "Resumen generado con IA · revisado por {editor}" |
| `respuesta_ia` | Chat | "Respuesta generada con IA a partir de N noticias publicadas" |
| `portada_generada` | Imagen de portada tipográfica | "Portada generada por la app (no es una fotografía)" |
| `ilustracion_ia` | Imagen generada por IA | Sello incrustado en la imagen + "Ilustración generada con IA. No documenta el hecho." |

La vista de lectura tiene una sección fija al final: **"Cómo se hizo esta noticia"** con fuentes (nombre, tipo,
enlace, fecha de consulta), certeza y su justificación, quién publicó, qué partes sugirió la IA, historial de versiones
y correcciones.

## 5. Papel de la IA en la validación (asistente, nunca juez)

La IA en `/admin/enrich` puede:
- Extraer afirmaciones verificables del texto y marcar cuáles no parecen tener fuente.
- Señalar posible sensacionalismo en el título.
- Sugerir temas, alcance geo e importancia.

La IA no puede:
- Marcar una afirmación como `respaldada` (solo el editor al vincular una fuente).
- Asignar certeza.
- Publicar.

Todo lo sugerido se guarda en `aiSuggestions` y el portal muestra qué aceptó y qué cambió el editor. Esto se usa en
la presentación como evidencia de "¿qué decisiones requieren criterio humano?".

## 6. Correcciones y retractaciones

- Cada publicación incrementa `version` y guarda snapshot en `news/{id}/versions/{v}`.
- Toda edición posterior a la publicación exige un `CorrectionEntry` con resumen visible.
- La app muestra "Actualizada {hora}: {resumen}" arriba del texto.
- `[PLUS]` Si una noticia que el usuario ya leyó (`readNewsIds`) recibe una corrección o retractación, la app muestra
  un aviso en el feed: "Una noticia que leíste fue corregida".
- Al retractar: el portal llama `/admin/index/remove` para que el chat deje de citarla de inmediato.
