# F3-01 — Capa de datos del feed

Fecha: 2026-10-09 · Responsable: Nelson · Rama: `fase-3/f3-01-feed-data`
Base: `origin/main` actualizado, squash `5884e79` del PR #20 (F3-08).

## Resultado y criterios

`watchNewsFeed` escucha en Firestore `config/public`, noticias publicadas dentro de la ventana configurable
y noticias esenciales de las últimas 72 h. Ambas consultas incluyen `workflow == 'publicada'`, como exigen
las reglas. El resultado elimina retractadas y fechas futuras, conserva la revisión más reciente por ID
y expira elementos por tiempo. `useNewsFeed` devuelve noticias, configuración, estados de carga/vacío/error
y una función de reintento. `useProfile` en `ProfileProvider` escucha `users/{uid}` y cancela el listener al
cambiar o cerrar sesión; la ubicación se sigue guardando en el perfil.

**CA1 probado en el emulador:** con la suscripción abierta y vacía, el test crea un borrador como editor y
lo publica mediante la función del portal `publishNews`. La noticia aparece sin reiniciar la suscripción,
antes del límite de 5 s desde el inicio de la publicación. También se verifica que `indexPending: true`
no la oculta. Son las reglas reales de Firestore y los índices declarados para producción.

Pruebas adicionales: configuración ausente y eliminada durante la sesión, cambio de ventana de 24 a 72 h,
esenciales de 48 h, deduplicación, exclusión de borradores/retractadas/vencidas/futuras, desaparición tras
retractación, error explícito para una noticia publicada inválida y actualización del perfil sin recargar.

**Pendiente para marcar Done:** conectar el hook a la pantalla F3-04 y hacer un recorrido en Expo Go en
un teléfono real para comprobar el proveedor React, login y navegación. El entorno de esta sesión no tiene
`adb` ni un teléfono accesible; no se declara prueba física. La prueba del emulador ejercita el servicio
que usa el hook y el flujo de publicación del portal, no monta una pantalla de React Native.

## Verificación

```bash
pnpm -F mobile typecheck
pnpm -F firebase-tests typecheck
pnpm -F firebase-tests test
pnpm lint
pnpm typecheck
pnpm test
git diff --check
```

**513 pruebas correctas** en el repositorio: 258 shared, 40 Firestore, 71 admin y 144 Worker.
Lint y typecheck globales verdes; `git diff --check` sin errores. Firestore Emulator: 40 pruebas correctas
(6 nuevas de F3-01). El primer intento dentro del sandbox
falló con `listen EPERM` en los puertos locales; se repitió fuera del sandbox con autorización y pasó.
La salida final de lint, typecheck y suite completa queda en [F3-01-validation.txt](F3-01-validation.txt).

No se agregaron dependencias nativas ni se usó GPS, Worker o modelos. Gasto de IA de esta tarea: USD 0.
No se publicaron noticias reales ni se modificó el checklist editorial de Nelson.
