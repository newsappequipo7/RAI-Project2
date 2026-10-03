# Imágenes

## 1. Jerarquía (el portal la presenta en este orden)

| Orden | Opción | Costo | Riesgo de engaño | Requisitos |
|---|---|---|---|---|
| 1 | **Foto real** subida por el editor | 0 | Bajo | Crédito del autor, licencia/permiso, fuente |
| 2 | **Licencia libre** (Openverse, Wikimedia Commons) | 0 | Medio (foto genérica que no es del hecho) | Crédito, licencia CC, enlace; pie "Imagen de archivo, no corresponde al hecho" |
| 3 | **Portada tipográfica** generada por código | 0 | Nulo | Pie "Portada generada por la app (no es una fotografía)" |
| 4 | **Ilustración con IA** | Créditos | Alto si es realista | Deshabilitada por defecto; ver §4 |

La opción recomendada cuando no hay foto es la **3**. Es la decisión que mejor equilibra costo, derechos y riesgo.

## 2. Portada tipográfica (`apps/admin/src/lib/cover/`)

Generada en el navegador con `<canvas>` y subida como PNG, o renderizada en la app como componente (preferible:
sin almacenamiento). Contenido: color del tema principal, título en tipografía grande, silueta o nombre del país/región,
ícono del tema, y la leyenda fija en la esquina "Portada generada · no es foto". Determinista: misma noticia → misma
portada. Si se renderiza en la app, `image.kind = 'portada_generada'` y `url = ''`.

## 3. Búsqueda con licencia libre

`POST /admin/image/search` consulta Openverse (API pública, imágenes CC) y Wikimedia Commons. Guardar siempre
`creator`, `license`, `licenseUrl`, `sourceUrl`. Excluir licencias `NC` si hubiera cualquier duda de uso. El pie en la
app siempre dice "Imagen de archivo" para que no se interprete como foto del hecho.

Almacenamiento de imágenes subidas: Cloudinary plan gratuito con *upload preset sin firma* (ADR-010); también se
puede enlazar la URL de origen con crédito. Firebase Storage exige plan Blaze en proyectos nuevos; no usarlo salvo ADR.
Configuración del preset y variables `VITE_CLOUDINARY_*`: ver ADR-010.

Reglas al publicar (las aplica `validatePublish`): toda imagen lleva crédito y texto alternativo; foto real y licencia
libre llevan URL, licencia y enlace de origen; la portada generada no lleva URL; la ilustración IA lleva su
`aiDisclosure`.

## 4. Ilustración con IA (último recurso)

Solo si `flags.imageGenEnabled = true`. Reglas en el prompt de sistema (fijas, no editables por el editor):
- Estilo ilustración plana/editorial, **nunca fotorrealista**.
- Sin personas identificables, sin logotipos, sin recreación del hecho (sin escenas de accidentes, protestas, víctimas).
- Representar el **tema** de forma conceptual (p. ej. "economía" → gráficos abstractos).

Etiquetado doble:
1. Sello visible incrustado en la esquina de la imagen: "Ilustración IA".
2. Metadato `image.aiDisclosure` + pie en la app: "Ilustración generada con IA. No documenta el hecho."

`[PLUS]` Escribir en los metadatos IPTC del archivo el tipo de fuente digital de "medios generados por algoritmo"
(verificar el valor exacto del vocabulario IPTC Digital Source Type al implementar).

## 5. Qué ve el lector

Todas las imágenes tienen pie con tipo y crédito. Tocar la imagen abre una hoja con: tipo, autor, licencia, enlace de
origen y, si aplica, la advertencia de IA. Las portadas y las ilustraciones IA nunca se muestran sin pie, ni siquiera
en tier `compacta` (ahí va un ícono con tooltip).
