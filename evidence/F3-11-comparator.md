# F3-11 — Comparador de ubicaciones

Fecha: 2026-10-09 · Responsable: Nelson · Rama: `fase-3/f3-11-location-comparator`

La ruta `/compare` del portal observa noticias publicadas y `config/public` en Firestore.
Calcula las ocho columnas con `rankFeed` de `@repo/shared`, el mismo motor usado por
la app. El perfil predeterminado es el de un lector nuevo sin historial; el selector
ofrece además intereses en deportes, tecnología con política silenciada y economía.
Cada celda muestra posición y nivel visual; `E` indica «Lo que debes saber». Se
puede destacar una noticia y abrirla en el editor. El panel inferior muestra temas
distintos y conteos por alcance en los primeros diez lugares de cada ciudad.
La ruta anterior `/comparador` redirige a `/compare`.

| Criterio | Estado | Evidencia |
|---|---|---|
| CA1: misma posición que la app con ubicación y perfil neutro iguales | Verificado en emulador | [`comparatorFeed.test.ts`](../firebase-tests/comparatorFeed.test.ts) compara la suscripción móvil y la del portal con fecha, configuración y perfil iguales, usando varias noticias del corpus y las ocho ciudades. Comprueba orden, posición, nivel y diversidad. |
| CA2: publicación actualiza el comparador sin recargar | Verificado en emulador | La misma prueba mantiene la suscripción abierta, ejecuta `publishNews` y observa la noticia antes de cinco segundos. |

```text
pnpm lint             OK
pnpm typecheck        OK
pnpm test             OK: shared 259, Firestore 60, admin 71, Worker 145 (535 pruebas)
pnpm -F admin build   OK
```

Falta recorrer visualmente `/compare` en el navegador del portal con sesión admin,
revisar la tabla horizontal y los cuatro perfiles con el corpus publicado, y
registrar una captura. La prueba automatizada usa el emulador y no valida el aspecto.
