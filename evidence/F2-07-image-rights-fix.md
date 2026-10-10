# F2-07 — Corrección de derechos y procedencia de imágenes

Fecha: 2026-10-09. Rama: `fase-3/f3-07-reading-provenance` (a petición de Nelson).

La búsqueda de Commons antes aceptaba cualquier etiqueta no vacía que no contuviera `NC`, incluso una etiqueta ambigua. Ahora solo acepta CC BY, CC BY-SA, CC0 y Public Domain Mark con versión reconocida, genera el enlace canónico y descarta metadatos de licencia contradictorios. La misma regla se aplica a Openverse. El editor debe revisar la página de origen antes de publicar; la clasificación de la API no sustituye esa revisión.

El constructor de imágenes libres ahora guarda `licenseUrl` en `News.image`. El tipo y el esquema lo dejan opcional para leer noticias antiguas. El portal y la ficha de procedencia de la app muestran el enlace cuando está disponible.

Verificación local:

- `shared`: 14 pruebas de imágenes y esquema, verdes.
- `api`: 10 pruebas de la ruta de imágenes, verdes; incluyen licencias ambiguas, `NC` y enlace contradictorio.
- `admin`: 6 pruebas de Cloudinary, verdes.
- `firebase-tests`: 3 pruebas del componente `NewsImage`, verdes; 3 pruebas F2-07 de publicación en el emulador de Firestore, verdes, incluida la persistencia de `licenseUrl`.
- Typecheck de `shared`, `api`, `mobile`, `admin` y `firebase-tests`: verde. ESLint general, Prettier y ESLint del componente Svelte, y `git diff --check`: verdes.

Pendiente: comprobar visualmente en Expo Go, en un teléfono real, que la ficha de procedencia abre el enlace de licencia. No se consultaron Openverse ni Commons en vivo durante estas pruebas; sus respuestas fueron simuladas.

Política de referencia: [Wikimedia Commons — Licensing](https://commons.wikimedia.org/wiki/Commons:Licensing) y [Creative Commons — licencias](https://creativecommons.org/cc-licenses/).
