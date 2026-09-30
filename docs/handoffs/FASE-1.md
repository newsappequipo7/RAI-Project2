# Handoff FASE-1 → FASE-2

Responsable: Diego Valenzuela · Fecha de cierre: 2026-09-29 · Tag: `fase-1-done`

## 1. Qué quedó funcionando (demostrable)
- **Login con Google** en la app móvil (Expo Go en iPhone y Android, y build nativo en iPhone) mediante un puente web en
  el portal (ADR-003). Sesión persistente.
- **Portal admin** en `https://ai-news-app-f24cf.web.app` con login y guardia de admin (`admins/{uid}`). Páginas: Costos,
  Índice, Comparador/Noticias/Instalar (esqueletos).
- **Reglas de Firestore** desplegadas y probadas en emulador (13 pruebas).
- **Worker** `https://news-api.diegovalenzuela.workers.dev` (Hono, D1, KV): verificación de ID tokens de Firebase, guardia
  de admin, CORS, `/health`.
- **Gateway de IA** (`services/api/src/ai/gateway.ts`): único punto de salida a modelos, ledger en D1, umbrales
  8/11/13/20 USD, kill switch, flags, límite de chat, modo `mock`. Costo real validado contra el panel de Anthropic.
- **Índice RAG** en KV (`/admin/index/*`) con embeddings `@cf/baai/bge-m3` y búsqueda por coseno que excluye retractadas.
- **Corpus semilla**: 40 noticias en `packages/shared/fixtures/news.json`, cargadas en Firestore de producción con
  `pnpm seed`.
- **Perfil y ubicación simulada** en la app: pantalla de selección, ubicación visible en chat y perfil, persistida en
  `users/{uid}`.
- **CI** (`.github/workflows/ci.yml`): lint, typecheck y pruebas, más un bloqueo de patrones `sk-ant-`.
- **Comandos de Claude Code** en `.claude/commands/`: `/iniciar-fase`, `/cerrar-fase`, `/registrar-loop`.

## 2. Cómo correrlo desde cero
Requisitos: Node 24 (mínimo 22: las pruebas del Worker usan `node:sqlite`), pnpm 11.6 (`corepack enable`), Java 21
(emulador de Firestore), `firebase-tools` (`npm i -g firebase-tools`), `gcloud`, cuenta de Expo (o `npx expo logout` para
usar túnel anónimo).

```bash
git clone git@github.com:newsappequipo7/RAI-Project2.git && cd RAI-Project2
pnpm install
pnpm lint && pnpm typecheck && pnpm test      # todo en modo mock, sin gastar créditos
```

Variables (solo nombres; los valores los tiene Diego):
| Dónde | Nombre | Para qué |
|-------|--------|----------|
| `apps/admin/.env` (ver `.env.example`) | `VITE_EXPO_PROJECT_URL` | URL `exp://…` del túnel de Expo que el puente usa como destino de desarrollo |
| `apps/admin/.env` | `VITE_API_URL` | Opcional; por defecto apunta al Worker desplegado |
| `services/api/.dev.vars` (ver `.dev.vars.example`) | `ADMIN_UIDS` | UIDs de admin separados por coma, solo para `wrangler dev` |
| Secret del Worker (`wrangler secret put`) | `ANTHROPIC_API_KEY` | Solo Diego. **Nadie más la usa ni la copia a un archivo** (regla de oro 9) |

Ejecutar cada pieza:
```bash
pnpm -F admin dev                     # portal en localhost:5173
pnpm -F api dev                       # Worker local (AI_MODE=mock)
pnpm -F mobile start --tunnel         # Expo Go; si el túnel falla, reintentar o usar LAN/hotspot
firebase emulators:start --only firestore
pnpm seed --target=emulator           # 40 noticias al emulador (--dry-run solo valida)
pnpm seed --target=prod               # producción: requiere `gcloud auth login` con la cuenta dueña del proyecto
```
Volver a indexar el corpus: portal → **Índice** → "Indexar corpus semilla". Nuevo admin: crear el documento
`admins/{uid}` en Firebase Console → Firestore (las reglas no permiten crearlo desde clientes).

Desplegar:
```bash
pnpm -F admin build && firebase deploy --only hosting
cd services/api && pnpm exec wrangler deploy            # siempre queda en AI_MODE=mock
cd services/api && pnpm exec wrangler deploy --var AI_MODE:live   # SOLO temporal; volver a desplegar sin --var
```

## 3. Estado de tareas
| ID | Estado | Evidencia | Nota |
|----|--------|-----------|------|
| F1-01 | ☑ | commits `067c591`, `57552db` | |
| F1-02 | ☑ | `2e6826f`, ADR-001 | Evidencia guardada fuera del repo (Diego). |
| F1-03 | ☑ | `afe0f22`, ADR-003, LOOP-001 | Evidencia guardada fuera del repo (Diego). |
| F1-04 | ☑ | `f38bdd9`, LOOP-002 | Evidencia guardada fuera del repo (Diego). |
| F1-05 | ☑ | `77688db` | 4 admins creados. Evidencia guardada fuera del repo (Diego). |
| F1-06 | ☑ | `17fed05` | 13 pruebas de reglas en emulador |
| F1-07 | ☑ | `7d6bb7d`, `884cebb` | 403 de no-admin con token real solo probado con llaves locales |
| F1-08 | ☑ | `c9c5d9b`, LOOP-003 | 72 pruebas; costo real = Console (16 in / 4 out, USD 0.000036) |
| F1-09 | ☑ | `dd32e1c`, LOOP-004 | 5/5 consultas correctas, puntajes 0.56–0.62 |
| F1-10 | ☑ | `7841a40` | 40 noticias en Firestore prod. El índice del corpus está pendiente (ver §5) |
| F1-11 | ☑ | `0bc805d` | Probado en Expo Go. Evidencia guardada fuera del repo (Diego). |
| F1-12 | ☑ | CI verde en `main` (GitHub Actions, run del commit `452e7cd`) | CA2 (Daniel corre todo desde cero con este handoff) hecho |

## 4. Desviaciones respecto a contratos o docs
Los docs ya están actualizados salvo lo indicado.
- `CONTRATOS-API.md`: se agregó `POST /admin/index/search` (herramienta de calibración) y `POST /admin/ai/selftest`;
  `index/remove` responde también `removed`. Solo hay una versión de índice vigente en KV (`rag:index:v{n}`); la
  anterior se borra al publicar. `upsert/remove/rebuild` borran todos los `digest:*`.
- ADR-008 verificado (bge-m3, 1 075 neuronas por millón de tokens, 10 000 neuronas/día gratis). **La dimensión del
  embedding no se midió** (la documentación no la publica; se asume 1024).
- ADR-001 y ADR-003 actualizados con los hallazgos (firma de 7 días, puente por Safari completo).
- El perfil `users/{uid}` se crea al elegir la primera ubicación (no antes de preguntarla), para no guardar un
  `locationId` fuera del catálogo.
- `pnpm seed` solo reindexa si existe `SEED_ID_TOKEN`; el camino normal es el botón de `/indice` en el portal.
- Las fuentes del corpus semilla son ficticias (URLs `example.org`). Las 4 imágenes `licencia_libre` son datos reales
  de Openverse/Commons obtenidos por una herramienta de resumen: conviene abrir cada URL antes de la demo.
- `env=demo` es una variable normal del Worker, no un secret. Decidir si debe protegerse.

## 5. Deuda y problemas conocidos
| Severidad | Problema | Sugerencia |
|-----------|----------|------------|
| Alta | La key de Anthropic vence el **2026-10-29** | Renovarla y volver a subirla con `wrangler secret put` antes de la presentación |
| Media | Emulador de Firestore: `isAdmin()` da "evaluation error" para no-admin (falla cerrada, causa desconocida) | Investigar; las pruebas pasan y el acceso es seguro |
| Media | No hay ningún `budget-snapshot` registrado | Registrar el saldo real cada lunes y antes de la demo |
| Media | Firma gratuita de iOS caduca cada 7 días | Repetir `pnpm -F mobile ios:native` antes de cada prueba; iPhone con Expo Go no se ve afectado |
| Baja | El portal no muestra si el Worker está en `mock` o `live` (causó una reindexación con embeddings falsos) | F2: agregar `aiMode` a `GET /health` (contrato + `HealthResponse`) y mostrarlo en la página Índice del portal |
| Baja | Dependencias: `pnpm audit` reporta 13 hallazgos (2 altos), todos en herramientas de desarrollo y ninguno en el bundle del Worker ni en el portal estático. 10 son `undici` vía `wrangler`/`miniflare` (corregido en `undici` ≥ 7.29.1, que trae `wrangler` 4.144.0); 1 es `cookie` (SvelteKit) y 2 son `decode-uri-component`/`uuid` (Expo) | Subir `wrangler` a ≥ 4.144.0 cuando cumpla la política de 24 h de `pnpm`; volver a correr `pnpm audit` |
| Baja | Tipos de rutas de Expo Router requieren correr `expo start` una vez para regenerar `.expo/types` | Solo afecta al typecheck local cuando se agrega una ruta |

## 6. Gasto de IA de la fase
- Según el ledger (`/admin/costs`): USD 0.000036 (una sola llamada real, `selftest`).
- Según el panel de Anthropic: Uso 16 tokens de entrada y 4 de salida, coincide. No hay `budget-snapshot` con saldo.
- Embeddings (Workers AI) no consumen créditos de Anthropic; dentro de la cuota gratuita diaria.
- Costo medio por tarea: solo `chat_answer` (selftest) tiene una muestra. Los demás se miden en F2 y F4.
- Cuidado con el portal: no muestra si el Worker está en `mock` o `live`. Con `mock` los puntajes de búsqueda son ~0.03 (vectores aleatorios); con `live` son ~0.56–0.62. Verificar con "Cargar corpus y correr consultas" antes de reindexar.

## 7. Qué necesita saber la siguiente persona antes de empezar
1. **Nunca llames a un modelo fuera del gateway** y no uses la key de Anthropic: todo el desarrollo debe correr con
   `AI_MODE=mock`. Hay una prueba de frontera que falla si aparece un SDK de proveedor fuera de `services/api/src/ai/`.
2. El estado de certeza lo pone una persona en el portal; el índice guarda la certeza tal cual y la búsqueda excluye
   las retractadas. Los contratos de `IndexInput`/`IndexEntry` y `News` ya están en `packages/shared`; F2 debe
   llamar a `/admin/index/upsert` al publicar y a `/admin/index/remove` al retractar o despublicar.
3. `pnpm seed --target=emulator` te da 40 noticias realistas (26 confirmadas, 8 en desarrollo, 3 disputadas,
   3 retractadas) para desarrollar sin esperar al portal. `packages/shared/src/seed.ts` tiene `buildSeedNews` y
   `toIndexInput`.

## 8. Loops registrados en esta fase
- LOOP-001: Login con Google en iOS, del popup al puente por Safari (F1-03)
- LOOP-002: Plan B en Xcode, crash de UIScene y firma de 7 días (F1-04)
- LOOP-003: Costo real frente a la tabla de precios del gateway (F1-08)
- LOOP-004: Primera medición para el umbral de abstención τ (F1-09)
