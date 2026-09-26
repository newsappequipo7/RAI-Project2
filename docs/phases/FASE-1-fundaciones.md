# FASE 1 — Fundaciones, distribución y gateway de IA (Persona 1)

## Resumen

| | |
|---|---|
| Entra | Repositorio vacío + estos documentos |
| Sale (demostrable) | Login con Google en iPhone y Android reales; app con 3 pestañas vacías y selector de ubicación; portal con login de admin; Worker desplegado con auth, gateway, ledger, kill switch e índice RAG; corpus semilla cargado |
| Tope de gasto IA | USD 0.50 |
| Fuera de alcance | Feed real, chat real, formulario editorial (fases 2–4) |

Orden recomendado: F1-01 → F1-02 → F1-03 (los dos spikes críticos primero) → F1-04 (timebox) → resto.
Si F1-02 o F1-03 fallan después de 2 intentos documentados, **parar y escalar al equipo** antes de seguir.

---

### F1-01 — Monorepo y paquete compartido
**Objetivo:** estructura base que todas las fases usan.
**Leer:** ARQUITECTURA.md §7, MODELO-DATOS.md completo.
**Pasos:**
1. `pnpm init` en raíz con `pnpm-workspace.yaml` (`apps/*`, `services/*`, `packages/*`, `evals`).
2. `tsconfig.base.json` con `strict: true`, `noUncheckedIndexedAccess: true`; cada paquete extiende de él.
3. ESLint + Prettier compartidos en raíz. Scripts raíz: `lint`, `typecheck`, `test`, `evals:chat`.
4. `packages/shared`: `src/types.ts` y `src/schemas.ts` exactamente según MODELO-DATOS.md §2; `src/catalogs/`
   (`locations.ts`, `topics.ts`, `importance.ts`, `countries-es.ts` con nombres y gentilicios de los países del catálogo
   y los más frecuentes en noticias internacionales); `src/index.ts` exporta todo. Vitest configurado.
5. Test de esquemas: un `News` válido pasa, uno sin fuentes con `certainty = 'confirmada'` pasa el esquema (la regla
   de negocio va en F2-05, no aquí), campos desconocidos fallan.
6. `.gitignore`, `.env.example` por paquete (solo nombres de variables).
**Criterios de aceptación:**
- CA1: `pnpm install && pnpm typecheck && pnpm -F shared test` pasan en un clon limpio.
- CA2: tipos y esquemas coinciden con MODELO-DATOS.md (revisión campo por campo en el PR).
**Evidencia:** salida de consola en el PR.

### F1-02 — Spike: app Expo en Expo Go (iPhone + Android)
**Objetivo:** confirmar Plan A de distribución.
**Leer:** IOS-ANDROID-DISTRIBUCION.md §1–2, ADR-001.
**Pasos:**
1. Verificar en un iPhone la versión de SDK que soporta Expo Go de la App Store. Anotarla en ADR-001.
2. Crear `apps/mobile` con esa versión, TypeScript y `expo-router`. Configurar Metro para monorepo (resolver
   `packages/shared`) según la guía oficial de Expo para monorepos.
3. Pestañas: `(tabs)/chat.tsx` (inicial), `(tabs)/feed.tsx`, `(tabs)/perfil.tsx`; pantalla `news/[id].tsx` vacía.
4. Importar un catálogo de `@repo/shared` en una pantalla para probar la resolución del monorepo.
5. `npx expo start --tunnel`; abrir en un iPhone y un Android de personas distintas.
6. Probar EAS Update + apertura desde Expo Go (o documentar por qué no aplica y usar túnel).
**Criterios de aceptación:**
- CA1: la app abre en Expo Go en iPhone y Android reales mostrando las 3 pestañas y datos de `shared`.
- CA2: ADR-001 actualizado con versión de SDK y método de carga elegido para la demo.
**Evidencia:** video corto de ambos teléfonos; LOOP si algo no funcionó a la primera.

### F1-03 — Firebase + login con Google (puente web)
**Objetivo:** login funcionando en Expo Go en ambas plataformas.
**Leer:** IOS-ANDROID-DISTRIBUCION.md §3, ARQUITECTURA.md §4, ADR-003.
**Pasos:**
1. Crear proyecto Firebase (plan Spark). Habilitar Auth con Google. Crear Firestore en modo producción.
2. Crear `apps/admin` mínimo (SvelteKit + `adapter-static`, modo SPA) solo con la ruta `auth/mobile` y desplegar a
   Firebase Hosting.
3. Implementar la página puente exactamente como describe el doc (lista blanca de redirect, fragmento, `signOut`).
4. En la app: servicio `src/services/firebase.ts` con `initializeAuth` + persistencia AsyncStorage; pantalla `login.tsx`;
   `AuthGate` que redirige a login si no hay sesión.
5. Flujo: botón "Continuar con Google" → navegador → Google → regreso a la app → sesión iniciada.
6. Prueba de seguridad: abrir la página puente con `redirect=https://evil.example` → debe negarse.
**Criterios de aceptación:**
- CA1: dos personas distintas inician sesión en iPhone y Android con Expo Go.
- CA2: al cerrar y reabrir la app, la sesión persiste.
- CA3: redirect fuera de lista blanca es rechazado (captura).
- CA4: el token nunca aparece en query string (revisar URL de redirección en la evidencia).
**Evidencia:** video; captura del rechazo; LOOP con los intentos fallidos (casi seguro habrá alguno).

### F1-04 — Spike Plan B: build nativo con ios-builder + MobAI (timebox: 1 día)
**Objetivo:** tener respaldo nativo en iPhone del equipo.
**Leer:** IOS-ANDROID-DISTRIBUCION.md §4.
**Pasos:**
1. Rama `native-build`: `npx expo prebuild -p ios`, esquema de URL `newsapp`.
2. Instalar `builder`, `builder auth github`, `builder init`, `builder ios build`.
3. Crear Apple ID de equipo (no personal). Instalar MobAI Free, conectar iPhone, activar Modo desarrollador, instalar.
4. Probar login con el puente usando `newsapp://auth`.
5. Registrar minutos de Actions consumidos y fecha de caducidad de la firma.
**Criterios de aceptación:**
- CA1: la app abre como app independiente en un iPhone del equipo e inicia sesión; o bien
- CA1-alt: si no se logra en el timebox, LOOP documentando el bloqueo exacto y la decisión de seguir solo con Plan A.
**Evidencia:** foto/video del ícono y login; LOOP.

### F1-05 — Portal base con login de administrador
**Objetivo:** esqueleto del portal que la Fase 2 llena.
**Leer:** ARQUITECTURA.md §2 y §7, MODELO-DATOS.md §3.
**Pasos:**
1. En `apps/admin`: layout con navegación (Noticias, Comparador, Costos, Instalar), login con `signInWithPopup`.
2. Guard: tras login, leer `admins/{uid}`; si no existe, pantalla "Sin acceso" con el uid visible para que alguien lo
   agregue en consola.
3. Crear documentos `admins/{uid}` de los 4 integrantes a mano en la consola.
4. Ruta `/instalar` con enlaces a Expo Go en ambas tiendas, QR del proyecto (configurable) y 3 pasos.
5. Rutas vacías con título para Noticias, Comparador y Costos.
**Criterios de aceptación:**
- CA1: un integrante entra; una cuenta ajena ve "Sin acceso".
- CA2: `/instalar` muestra QR escaneable que abre la app en Expo Go.
**Evidencia:** capturas.

### F1-06 — Reglas de Firestore e índices
**Leer:** MODELO-DATOS.md §3–4.
**Pasos:**
1. `firestore.rules` e `firestore.indexes.json` en raíz; `firebase.json` con emuladores de Auth y Firestore.
2. Pruebas con `@firebase/rules-unit-testing` en `packages/shared` o carpeta `firebase-tests/`:
   anónimo no lee nada; usuario lee publicadas y no borradores; usuario no escribe `news`; usuario solo lee/escribe su
   perfil; admin escribe `news`; nadie escribe `admins`.
3. Desplegar reglas e índices.
**Criterios de aceptación:** CA1: todas las pruebas de reglas pasan en el emulador; CA2: reglas desplegadas.
**Evidencia:** salida de pruebas.

### F1-07 — Worker base (Hono, auth, D1, KV)
**Leer:** CONTRATOS-API.md §1, ARQUITECTURA.md §4, MODELO-DATOS.md §5–6, ADR-004.
**Pasos:**
1. `services/api` con Wrangler + Hono + zod. Bindings: `DB` (D1), `KV`, `AI` (Workers AI).
2. Middleware de auth con `jose` (`createRemoteJWKSet`, issuer y audience de Firebase). Middleware admin con
   secret `ADMIN_UIDS` (lista separada por comas).
3. Middleware de errores con la forma estándar `{ error: { code, message } }`.
4. Migraciones D1 de MODELO-DATOS.md §5. `GET /health`.
5. CORS limitado al dominio del portal y a orígenes de desarrollo.
6. Desplegar en el plan gratuito.
**Criterios de aceptación:**
- CA1: sin token → 401; token válido de usuario → 200 en rutas de usuario; usuario no admin en `/admin/*` → 403.
- CA2: `/health` responde en producción.
**Evidencia:** pruebas (Vitest con tokens de prueba) + curl contra producción.

### F1-08 — Gateway de IA, ledger, umbrales y flags
**Objetivo:** el único punto de salida a modelos, con control de costo desde el día 1.
**Leer:** PRESUPUESTO-IA.md completo, ARQUITECTURA.md §5.
**Pasos:**
1. `src/ai/config.ts`: mapa `AiTask → { provider, model }`, leído de variables de entorno con defaults.
2. `src/ai/pricing.ts`: precios por modelo con comentario de URL y fecha de verificación.
3. Proveedores en `src/ai/providers/`: `mock` (fixtures), `llm` (el proveedor elegido por el equipo, con salida JSON),
   `workers-ai` (embeddings).
4. `gateway.run(task, input, ctx)`: revisa flags y umbrales → llama al proveedor → calcula costo → inserta en
   `ai_calls` → devuelve `{ output, usage, costUsd, model }`. Errores del proveedor también se registran (`outcome=error`).
5. Umbrales automáticos de PRESUPUESTO-IA.md §2 leyendo el total de D1 (cachear el total 60 s en memoria).
6. Rate limit por uid (tabla `rate_limits`).
7. `GET /admin/costs`, `POST /admin/flags`, `POST /admin/budget-snapshot`.
8. Una llamada real de prueba (`AI_MODE=live`) para validar el cálculo de costo contra el panel del proveedor.
**Criterios de aceptación:**
- CA1: con el total simulado en D1 ≥ 13 y `env=dev`, cualquier tarea devuelve `budget_blocked`; con `env=demo` pasa.
- CA2: el costo registrado de la llamada real coincide (±10 %) con lo que refleja el proveedor.
- CA3: `grep` no encuentra SDKs de proveedores fuera de `src/ai/`.
**Evidencia:** tests; captura de `/admin/costs`; LOOP si el costo real difiere de lo esperado.

### F1-09 — Índice RAG y búsqueda
**Leer:** CONTRATOS-API.md §3, CHAT-RAG.md §2 paso 5, ADR-005, ADR-008.
**Pasos:**
1. Verificar en la documentación de Cloudflare el modelo de embeddings multilingüe, su dimensión y la cuota gratuita;
   actualizar ADR-008.
2. `src/rag/index.ts`: `upsert`, `remove`, `rebuild`, versión en `rag:index:current`.
3. `src/rag/search.ts`: coseno, filtros (excluir retractadas, filtro por país), top-k.
4. Endpoints `/admin/index/*`. Invalidar `digest:*` afectados en upsert.
5. Pruebas unitarias con embeddings falsos deterministas.
**Criterios de aceptación:** CA1: upsert + búsqueda devuelve la noticia esperada para 5 consultas de prueba en español
con el modelo real; CA2: una retractada nunca aparece.
**Evidencia:** tests + tabla de 5 consultas con puntajes (sirve para calibrar τ en F4).

### F1-10 — Corpus semilla
**Objetivo:** datos realistas para que F2–F4 trabajen sin depender del portal.
**Pasos:**
1. `packages/shared/fixtures/news.json` con **40 noticias** ficticias pero verosímiles (marcar en `body` al final:
   "Noticia de prueba para el proyecto académico"). Cobertura obligatoria:
   - Todas las ubicaciones del catálogo con al menos 2 noticias locales o nacionales.
   - 8 internacionales, 3 globales.
   - Importancias: 6 esenciales (2 de GT, 1 de MX, 1 de ES, 2 globales), 10 importantes, resto rutina/relevante.
   - Certezas: 26 confirmadas, 8 en desarrollo, 3 disputadas, 3 retractadas.
   - Todos los temas representados; fuentes coherentes con la certeza.
   - Imágenes: mezcla de `licencia_libre` con datos reales de Openverse/Commons, `portada_generada` y ninguna IA.
   - Fechas relativas (`publishedHoursAgo`) que el script convierte a ISO al cargar.
2. Script `pnpm seed` que carga a Firestore (emulador o producción, con flag explícito) y llama `/admin/index/rebuild`.
3. IDs estables legibles (`n-gt-001`, `n-ret-001`, `n-gt-sismo`) para usar en el set dorado.
**Criterios de aceptación:** CA1: `pnpm seed --target=emulator` y `--target=prod` funcionan; CA2: validación zod de
las 40 noticias pasa.
**Evidencia:** salida del script; conteos por categoría.

### F1-11 — Perfil y selector de ubicación mínimos
**Pasos:**
1. En primer login, crear `users/{uid}` con valores por defecto y pedir ubicación con una pantalla `location.tsx`
   (lista del catálogo agrupada por país, con descripción "Ubicación simulada: no usamos tu GPS").
2. Mostrar la ubicación activa en el encabezado del chat y en perfil, con opción de cambiarla.
**Criterios de aceptación:** CA1: cambiar ubicación persiste en Firestore y se refleja al reabrir la app.
**Evidencia:** video corto.

### F1-12 — CI y cierre de fase
**Pasos:**
1. GitHub Actions: `lint`, `typecheck`, `test` en cada PR (sin llamadas reales a IA).
2. Comandos `.claude/commands` revisados y funcionando.
3. Completar `docs/handoffs/FASE-1.md`, expandir filas F1 en PLAN.md §6, `git tag fase-1-done`.
**Criterios de aceptación:** CA1: CI verde en `main`; CA2: la Persona 2 corre todo desde cero con el handoff.
