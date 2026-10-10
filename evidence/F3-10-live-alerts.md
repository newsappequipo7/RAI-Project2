# F3-10 — Tiempo real y aviso de noticia nueva

Fecha: 2026-10-09 · Responsable: Nelson · Rama: `fase-3/f3-10-live-alerts`

El feed compara los IDs de cada emisión de la suscripción existente. La primera emisión
establece la línea base y no muestra aviso. Si una noticia aparece después y `rankFeed` la
coloca entre las tres primeras o en «Lo que debes saber», muestra «Nueva noticia» fijo arriba.
Al tocarlo, desplaza la lista al inicio; si la noticia es esencial, también abre el bloque
contraído. Reintentar la suscripción restablece la línea base. Cambios de preferencias,
ubicación o reloj que solo reordenan IDs conocidos no disparan el aviso. Un cambio de ventana
de recencia también restablece la línea base para no llamar «nueva» a una noticia antigua.

No se añadió ninguna consulta a Firestore: se reutilizan las dos consultas publicadas y
el perfil ya observados por F3-01. El detector es código local y no invoca modelos.

| Criterio | Estado | Evidencia |
|---|---|---|
| CA1: una publicación produce aviso en dos teléfonos en <5 s | Parcial | Prueba con emulador: `publishNews` desde portal y dos lectores autenticados con suscripciones independientes; ambos detectan la noticia antes de 5 s. Falta repetirlo en dos teléfonos reales con Expo Go y registrar tiempos. |

[`newStoryAlert.test.ts`](../firebase-tests/newStoryAlert.test.ts) también comprueba que la
carga inicial, una noticia debajo del tercer lugar y un ID ya visto no generan aviso;
una noticia nueva entre las tres primeras o en esenciales sí lo genera. La prueba usa el
corpus fijo y el mismo `rankFeed` de la app.

```text
pnpm lint       OK
pnpm typecheck  OK
pnpm test       OK: shared 259, Firestore 59, admin 71, Worker 145 (534 pruebas)
git diff --check  OK
```

Validación pendiente en Expo Go: mantener Noticias abierto en dos teléfonos, publicar una
noticia que quede en top 3 o esenciales, comprobar que el aviso aparece en ambos en <5 s
y que al tocarlo la lista vuelve arriba. Registrar modelos, sistemas, red y tiempo observado.
La tarjeta de corrección/retractación marcada `[PLUS]` en el plan de fase no forma parte de
este cambio.
