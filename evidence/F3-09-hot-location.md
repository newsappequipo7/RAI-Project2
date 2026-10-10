# F3-09 — Cambio de ubicación en caliente

Fecha: 2026-10-09 · Responsable: Nelson · Rama: `fase-3/f3-09-hot-location`

Loop de integración: [LOOP-012](loops/LOOP-012-ubicacion-prueba-aislada.md).

Al escoger otra ciudad simulada, `ProfileProvider` proyecta la nueva ubicación sobre el perfil
visible antes de esperar a Firestore. El feed usa ese perfil para ejecutar `rankFeed` sobre las
noticias ya cargadas; `useNewsFeed` conserva su suscripción porque depende del UID, no de la
ubicación. El selector vuelve inmediatamente a la pestaña anterior. El encabezado de Chat y
la insignia del feed leen el mismo perfil reactivo. Un aviso de cinco segundos muestra:
«Estás viendo noticias como si estuvieras en {ciudad}» en feed, chat y Perfil. Nunca se usa GPS.

La escritura remota modifica solo `locationId` y `updatedAt`. Si falla, el perfil visible vuelve
a la ciudad anterior y aparece un aviso de error. La creación inicial del perfil sigue esperando
la escritura antes de entrar a las pestañas. Un ID de solicitud impide que una respuesta tardía
de una sesión anterior borre el estado de una sesión nueva.

## Criterio de aceptación

| Criterio | Estado | Evidencia |
|---|---|---|
| CA1: cambio visible en el feed en <300 ms | Parcial | La prueba `locationChange.test.ts` recalcula el corpus fijo con la ubicación nueva antes de esperar el write; el cálculo aislado tarda <300 ms en este entorno y cambia el top 10. Falta medir desde el toque hasta la nueva tarjeta pintada en Expo Go en un teléfono real. |

La prueba de Firestore también confirma que `locationId` se guarda y que `interests` permanece
intacto. Se ejecutó con reglas reales y usuario autenticado.

```text
pnpm lint       OK
pnpm typecheck  OK
pnpm test       OK: shared 259, Firestore 57, admin 71, Worker 145 (532 pruebas)
git diff --check  OK
```

Para cerrar CA1 en Expo Go: abrir Noticias, cambiar entre Ciudad de Guatemala y Madrid,
comprobar que el encabezado y el orden cambian al volver sin recargar, medir el intervalo
entre el toque y el primer cuadro con la nueva ciudad (meta <300 ms), y repetir desde Chat
para verificar su encabezado y el aviso. Registrar modelo de teléfono, sistema y tiempos.
Esta tarea no llama modelos ni gasta créditos de IA.
