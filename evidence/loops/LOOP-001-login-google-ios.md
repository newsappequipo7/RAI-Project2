# LOOP-001 — Login con Google en iOS: del popup al puente por Safari
2026-09-28 · Diego · Tareas: F1-03

## Comprensión
Se creía que Firebase Auth resolvía Google en Expo Go con el flujo estándar (popup/redirect) y que bastaba configurar el
proveedor.

## Hipótesis
Un puente web propio (SvelteKit en Firebase Hosting) haría el OAuth y devolvería el token a la app por deep link.
Primera versión: abrir el puente en una sesión de navegador embebida (`ASWebAuthenticationSession`).

## Construcción
Ruta `/auth/mobile` del portal, escucha de deep links en `AuthGate` y `signInWithCredential` con el ID token.
Commit `2ab548e`.

## Prueba y observación
En iPhone el login se quedaba en bucle o sin volver a la app con popup, con redirect y con OAuth manual dentro de la
sesión restringida. Se añadió la cabecera COOP en Hosting y depuración remota. El comportamiento mejoró solo al abrir
Safari completo con `Linking.openURL`. Persistió una intermitencia del lado de Google.

## Corrección / decisión
Abrir Safari completo, mantener el `redirect` pendiente en `sessionStorage`, devolver el token solo en el fragmento de
la URL y validar el destino contra una lista blanca (`exp://`, `newsapp://`). Prueba manual: un destino `evil.example`
se rechaza. Registrado en ADR-003.

## Rol de la IA en este loop
Claude Code propuso cuatro variantes sucesivas; las tres primeras fallaron en el dispositivo real. Una búsqueda web
dio información incorrecta sobre el SDK soportado por Expo Go: se descartó y se confió en la comprobación en el
teléfono. Lo que detectó cada error fue la prueba en el iPhone, no el typecheck ni las pruebas unitarias.
