# F3-05 — Imágenes y portada tipográfica

Estado: **◐** (implementación y pruebas automáticas completas; falta verificación en Expo Go en teléfono real).

## Resultado

- `CoverArt` usa `buildCoverSpec` y `wrapCoverTitle` de `@repo/shared`, con proporción 16:9, color, título, lugar y leyenda fija iguales a la vista previa del portal.
- `NewsImage` muestra siempre el pie de `imageCaption` bajo cada imagen visible. Al tocarla abre una hoja con tipo, crédito, licencia/permiso, origen enlazado cuando existe y advertencia de IA. La ilustración IA lleva además sello incrustado visible. Si falta la imagen, se usa la portada generada; si una URL publicada no es válida, se muestra un marcador con el pie original.
- En `compacta` se muestra un ícono de información que revela el pie y da acceso a la hoja de procedencia. Las tarjetas `hero`, `grande` y `mediana` usan el mismo componente.
- No hay nuevos módulos nativos, secretos ni llamadas a modelos.

## Criterio de aceptación

| Criterio | Evidencia | Pendiente |
|---|---|---|
| Cada tipo del corpus muestra su pie correcto | `firebase-tests/newsImageComponent.test.js` renderiza los dos tipos presentes en el corpus semilla: portada y licencia libre. Casos adicionales renderizan foto real, ilustración IA y ausencia de imagen. 3 pruebas pasan. | Revisar texto, recorte y hoja en Expo Go. |
| Imposible renderizar imagen sin pie | `NewsImage` deriva el pie internamente de `imageCaption`, sin prop opcional; la prueba renderiza cada rama visible y comprueba su pie. En compacto no se renderiza la imagen y el pie queda en la etiqueta accesible del ícono y el tooltip. | Confirmar con lector de pantalla en teléfono. |

## Verificación ejecutada

- `pnpm lint`: verde.
- `pnpm typecheck`: verde en todos los paquetes.
- `pnpm test`: 519 pruebas verdes (shared 258, Firestore 46, portal 71, Worker 144).
- `pnpm -F mobile exec expo export --platform android --output-dir /tmp/f3-05-android`: exportó.
- `pnpm -F mobile exec expo export --platform ios --output-dir /tmp/f3-05-ios`: exportó.
- `git diff --check`: verde.

La exportación confirma el bundle; no sustituye la prueba táctil ni la inspección visual en Expo Go. Para cerrar: abrir Noticias en un teléfono real, comprobar una portada y una imagen de archivo en hero/mediana, tocar cada imagen y revisar la hoja; abrir un ítem compacto, tocar `ⓘ` y revisar su tooltip. Registrar modelo, sistema, resultado y captura/video. El corpus no incluye foto real ni ilustración IA: revisar esos tipos con una noticia de prueba publicada por un editor cuando estén disponibles. No se alteraron noticias ni checklist editoriales.
