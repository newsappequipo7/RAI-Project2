# Registro de decisiones (ADR)

Formato corto. Una decisión nueva = una entrada nueva al final. No se edita una decisión aceptada: se reemplaza con otra
que diga "Reemplaza ADR-00X". Estas decisiones son evidencia para la sección 6 de la presentación.

Plantilla:
```
## ADR-0XX — Título
Estado: propuesta | aceptada | reemplazada por ADR-0YY
Fecha: YYYY-MM-DD · Autor: Persona N
Contexto: qué problema o restricción obliga a decidir.
Opciones: A, B, C con pros/contras en una línea cada una.
Decisión: la elegida.
Consecuencias: qué ganamos, qué perdemos, qué hay que vigilar.
Evidencia: enlace a loop, medición o prueba que la respalda.
```

---

## ADR-001 — Expo compatible con Expo Go como app móvil
Estado: aceptada
Contexto: nadie del equipo tiene cuenta Apple Developer de pago y el presupuesto lo prohíbe. Los compañeros deben poder
usar la app en su iPhone durante la clase.
Opciones: (A) Expo + Expo Go: se instala desde App Store gratis y carga nuestro JS. (B) Build nativo vía ios-builder
(GitHub Actions) + reinstalación con Apple ID gratuito vía MobAI: vence a los 7 días y requiere USB por dispositivo.
(C) PWA: no es "app" y en iOS el login y la instalación son menos confiables.
Decisión: A como plan principal, B como respaldo para teléfonos del equipo, C como emergencia.
Actualización 2026-09-26: el equipo tiene MacBooks, así que B se hace con Xcode y Apple ID gratuito en lugar de
ios-builder + MobAI (que queda como alternativa sin Mac).
Actualización 2026-09-27 (spike F1-02): Expo Go instalado desde App Store en iPhone real soporta **SDK 57**
(verificado en el dispositivo; contradice el estado público de la documentación de Expo, que en esa fecha señalaba
SDK 54 como tope — se confía en la verificación física, no en la doc externa). `apps/mobile` se creó con
`expo@~57.0.25` + `expo-router@~57.0.23`, TypeScript estricto y monorepo pnpm (`packages/shared` vía
`workspace:*`). Carga para desarrollo: `npx expo start --tunnel` (red universitaria aísla clientes). Requiere
`.npmrc` con `shamefully-hoist=true` en la raíz: sin eso, Metro no resuelve dependencias transitivas de paquetes
Expo bajo el layout estricto de `node_modules` de pnpm (error `Unable to resolve module debug` y similares).
Falta confirmar en el spike: si la actualización EAS Update puede cargarse desde Expo Go para este proyecto
(pendiente hasta tener build de demo) — si falla, usar túnel desde laptop con hotspot propio el día de la demo.
Actualización 2026-09-28 (spike F1-04, Plan B): build nativo con Xcode 27 + Apple ID gratuito, probado en un iPhone
real. Bloqueante encontrado: Xcode 27 compila contra un SDK de iOS que **exige** el ciclo de vida `UIScene`; la
plantilla nativa que genera `expo prebuild` para SDK 57 todavía no lo declara en `Info.plist`, así que la app se cierra
al abrir con "UIScene life cycle is required for apps built with this SDK" (bug conocido de Expo,
[expo/expo#46664](https://github.com/expo/expo/issues/46664)). Arreglo: plugin `expo-build-properties` con
`ios.enableSceneSupport: true` en `app.json` (Expo lo retro-portó a partir de SDK 57.0.23). También se fijó
`ios.bundleIdentifier` (`gt.uvg.newsapp.dv`) y `ios.appleTeamId` en `app.json` para que sobrevivan a un
`expo prebuild` limpio (si no, hay que volver a elegir el Team a mano en Xcode → Signing & Capabilities cada vez).
La firma gratuita expira a los **7 días exactos** desde la instalación (verificado con
`security cms -D -i embedded.mobileprovision`, no es aproximado): reinstalar (`pnpm -F mobile run ios:native` con el
iPhone conectado, o ▶️ en Xcode) regenera el perfil automáticamente por otros 7 días — no hay que crear nada a mano,
solo recompilar dentro de la ventana de la demo. El login con el puente funciona igual usando el esquema nativo
`newsapp://` en vez de `exp://`. `ios/` no se commitea (gitignored, se regenera con `expo prebuild -p ios`); los
scripts `ios`/`android` del root siguen apuntando a Expo Go (`expo start --ios/--android`) para no romper el flujo
del equipo — el build nativo vive en `ios:native`/`android:native`.
Consecuencias: prohibido agregar módulos nativos fuera de Expo Go; Google Sign-In nativo no disponible → puente web (ADR-003);
si Expo actualiza Expo Go a una versión que deje de soportar SDK 57 durante el semestre, no actualizar el SDK del
proyecto sin volver a verificar en un dispositivo real. Para el build nativo (Plan B), cualquiera que lo reconstruya
necesita Xcode completo (~35 GB) instalado y su propio Apple ID logueado en Xcode → Settings → Accounts.

## ADR-002 — Ranking por código, no por LLM
Estado: aceptada
Contexto: el enunciado pide evitar llamadas costosas cuando ordenar o presentar pueda resolverse más barato.
Decisión: motor de ranking determinista en `packages/shared/ranking`, compartido por app, portal y pruebas.
Consecuencias: costo 0 en lectura, explicable, testeable. Perdemos matices semánticos finos; se compensan con temas y
geo enriquecidos una sola vez al publicar.

## ADR-003 — Login móvil mediante puente web de Firebase
Estado: aceptada
Contexto: Expo Go no incluye el SDK nativo de Google Sign-In.
Decisión: página `/auth/mobile` en Firebase Hosting que autentica con el SDK web y devuelve el `id_token` de Google por
deep link en el fragmento; la app lo canjea con `signInWithCredential`.
Actualización 2026-09-27 (spike F1-03): tres iteraciones hasta llegar a algo confiable.
1. `signInWithRedirect` + `getRedirectResult` (plan original): no funciona dentro de la sesión restringida que abre
   `expo-web-browser` (`openAuthSessionAsync`, `ASWebAuthenticationSession` en iOS) — el estado pendiente del redirect
   no sobrevive el viaje de ida y vuelta a Google, así que `getRedirectResult` siempre da `null` y la página relanza el
   login, generando un loop con el selector de cuenta. Riesgo anticipado en `IOS-ANDROID-DISTRIBUCION.md` §3.
2. `signInWithPopup`: falla igual dentro de esa sesión porque `ASWebAuthenticationSession` no soporta `window.open`
   (confirmado: funciona perfecto en Safari de escritorio y en Safari normal del iPhone, nunca dentro de la sesión que
   abre la app).
3. **Decisión final**: la app abre el puente con `Linking.openURL` (Safari completo del sistema, no
   `expo-web-browser`), y el puente hace el intercambio OAuth de Google **manualmente** (`accounts.google.com/o/oauth2/v2/auth`
   con `response_type=id_token`, sin SDK de Firebase de por medio) usando una sola navegación de página completa —
   exactamente lo que Safari soporta. El `redirect` original se guarda en `sessionStorage` antes de salir a Google y se
   recupera al volver. La app captura el regreso con `Linking.addEventListener('url', …)` en vez de esperar la promesa
   de `openAuthSessionAsync`. Requiere una URI de redirección fija registrada a mano una vez en Google Cloud Console
   (`https://ai-news-app-f24cf.web.app/auth/mobile`, client ID web que Firebase creó automáticamente) — nunca cambia,
   a diferencia de las URIs `exp://` dinámicas por túnel. `expo-auth-session` (la alternativa "oficial" de Expo) se
   descartó: la propia documentación de Expo dice que Expo Go no puede probar flujos OAuth por no poder personalizar
   el esquema de la app, y confirma que se necesitaría un Development Build (viola la regla de un solo Expo Go).
   Nota de campo: durante las pruebas, el flujo mostró un loop intermitente y sin mensaje de error en el selector de
   cuenta de Google incluso con Safari completo; se resolvió solo tras un par de intentos (posible fricción temporal
   de Google por reintentos repetidos desde el mismo client ID/cuenta en poco tiempo). Si reaparece, revisar con Web
   Inspector remoto antes de asumir que el código está mal — cuando la mecánica ya se verificó con una prueba manual
   exitosa, es más probable que sea un problema externo pasajero que un bug de la página puente.
Consecuencias: un solo camino de login para Expo Go, build nativo y web. Riesgo: fuga de token por redirección abierta
→ lista blanca de esquemas de redirect y token en fragmento (nunca en query string, en ninguno de los dos saltos).
`packages/shared`/Firebase JS SDK ya no se usa en la página puente (solo `fetch`/navegación nativa del navegador); la
app sigue usando `signInWithCredential` del SDK de Firebase para canjear el `id_token` de Google.

## ADR-004 — Backend en Cloudflare Workers (plan Free), sin Admin SDK de Firebase
Estado: aceptada
Contexto: Cloud Functions requiere plan Blaze (tarjeta). Queremos infraestructura gratis y sin tarjeta.
Opciones: (A) Cloud Functions en Blaze. (B) Cloudflare Worker + KV + D1 + Workers AI. (C) Servidor propio en un PaaS gratis.
Decisión: B. Firestore sigue siendo fuente de verdad y lo escriben los clientes con reglas; el Worker mantiene un índice
derivado en KV que el portal actualiza al publicar.
Consecuencias: embeddings sin gastar créditos (Workers AI), ledger en D1, y acceso a Jev vía Workers AI para el
laboratorio. Hay que mantener sincronía KV↔Firestore (endpoint `rebuild`).

## ADR-005 — Búsqueda semántica por fuerza bruta en el Worker
Estado: aceptada
Contexto: el corpus de la demo será de decenas a pocos cientos de noticias.
Decisión: similitud coseno sobre todo el índice en memoria del Worker, cargado desde KV.
Consecuencias: cero infraestructura adicional. Revisar si el corpus supera ~2 000 noticias (entonces Vectorize).

## ADR-006 — La certeza la decide un humano; el modelo no puede elevarla
Estado: aceptada
Decisión: `certainty` solo se escribe desde el portal. El chat hereda la certeza de las noticias citadas. Las sugerencias
de IA en el portal quedan guardadas en `aiSuggestions` para auditar qué se aceptó.

## ADR-007 — Portada tipográfica generada por código como opción preferida sin foto
Estado: aceptada
Contexto: generar imágenes con IA cuesta créditos y puede parecer evidencia real.
Decisión: jerarquía foto real → licencia libre → portada tipográfica (código, costo 0) → ilustración IA (deshabilitada
por defecto, etiquetada). Ver `docs/domain/IMAGENES.md`.

## ADR-008 — Modelo de embeddings multilingüe en Workers AI
Estado: propuesta (verificar en F1-09)
Decisión: `@cf/baai/bge-m3` por soporte de español. Confirmar nombre, dimensión y cuota gratuita en la documentación
de Cloudflare antes de indexar. Si cambia, reindexar todo (`/admin/index/rebuild`).

## ADR-009 — Claude Haiku 4.5 como LLM por defecto
Estado: aceptada
Fecha: 2026-09-26 · Autor: Diego
Contexto: los USD 20 están en una sola cuenta de Anthropic con una sola API key.
Opciones: (A) Haiku 4.5: el más económico de la familia actual. (B) Sonnet: mejor calidad, varias veces más caro.
(C) Modelo gratuito de Workers AI: costo 0, calidad en español a evaluar.
Decisión: A (`claude-haiku-4-5-20251001`) para `enrich`, `chat_answer` y `digest`. C queda como modo de degradación
si el presupuesto se agota. Precio de referencia (reportado para septiembre 2026): USD 1 por millón de tokens de entrada
y USD 5 por millón de salida; verificar en https://platform.claude.com/docs/en/about-claude/pricing al configurar
`pricing.ts`.
Consecuencias: costo estimado ≈ USD 0.005 por respuesta de chat y ≈ USD 0.004 por enriquecimiento (ver
PRESUPUESTO-IA.md §4). Si las evals muestran calidad insuficiente en español, evaluar Sonnet solo para `chat_answer`
con un loop que mida costo vs calidad.
