# Setup del día 0 (antes de escribir código)

Responsable general: **Diego**. Fecha límite: domingo 27 de septiembre.

## 1. Cuentas (se crean con la cuenta de Google del equipo; todos reciben acceso con su cuenta personal)

- [ ] **Cuenta de Google del equipo** (p. ej. `newsapp.equipo@gmail.com`). Dueña de Firebase, Cloudflare y Expo.
- [ ] **Organización de GitHub** con el repo **público**. Miembros: Diego, Daniel, Nelson, Joaquín.
  Protección de `main` (PR + 1 revisión + CI verde). GitHub Project con columnas Backlog / En curso / Revisión / Done.
- [ ] **Firebase** (plan Spark): agregar los 4 en IAM como Editor; Auth → Google habilitado; Firestore en modo
  producción; Hosting activado; registrar app web y guardar la config pública en `apps/*/.env.example`.
- [ ] **Cloudflare** (plan Free): invitar a los 4 como miembros; crear subdominio de Workers, base D1 `news-db`,
  namespace KV `news-kv`.
- [ ] **Expo**: organización del equipo con los 4 miembros (para EAS Update y QR de demo).
- [ ] **Apple ID gratuito del equipo** (iCloud nuevo, no personal) para firmar el build nativo desde Xcode.
- [ ] **Anthropic** (ya existe: una cuenta, una API key, tope USD 20). Ver §2.
- [ ] Decidir almacenamiento de fotos (Cloudinary gratuito o solo URL externa). Si es Cloudinary, crear cuenta.

## 2. La API key de Anthropic

- La key vive **solo** como secret del Worker (`wrangler secret put ANTHROPIC_API_KEY`). La configura Diego.
  Nadie la guarda en `.env`, en el repo público, en Slack ni en el gestor de contraseñas compartido.
- Desarrollo local = `AI_MODE=mock`. Las llamadas reales pasan por el Worker de dev desplegado.
- Como hay una sola key, la separación dev/demo la hace el Worker (`env=dev|demo`, umbrales en PRESUPUESTO-IA.md).
- Anotar hoy el saldo inicial que muestra la consola de Anthropic (primer registro de la sección de costos).
- **Claude Code nunca usa esta key.** Cada persona usa su propia suscripción/cuenta. Verificar que nadie tenga
  `ANTHROPIC_API_KEY` exportada en su terminal con la key del proyecto: Claude Code la tomaría y consumiría el presupuesto.
- El repo es público: activar GitHub secret scanning y agregar un hook o paso de CI que falle si detecta `sk-ant-`.

## 3. Secretos compartidos (mínimos)

Solo dos credenciales se comparten: contraseña de la cuenta de Google del equipo y del Apple ID del equipo.
Van en un gestor con bóveda compartida (Bitwarden u otro; verificar cuántos usuarios admite el plan gratuito).
Los secrets de CI van en GitHub Actions secrets. Los del Worker, en `wrangler secret`.

## 4. Máquinas

| Persona | Máquina | Instalar |
|---|---|---|
| Diego, Daniel, Joaquín | MacBook | Node LTS, pnpm, git, Firebase CLI, Wrangler, Claude Code, **Xcode** (Diego obligatorio; al menos uno más recomendado) |
| Nelson | Windows | Node LTS, pnpm, git, Firebase CLI, Wrangler, Claude Code. Recomendado WSL2 si algún script de shell falla. No necesita Xcode |

Todos: Expo Go en su teléfono y acceso verificado a GitHub, Firebase, Cloudflare y Expo.

## 5. Teléfonos (2 iPhone, 2 Android)

- [ ] Anotar modelo y versión de SO de cada uno en esta tabla.
- [ ] Instalar Expo Go en los 4 y anotar la versión de SDK que soporta en iPhone (la necesita F1-02).
- [ ] En los 2 iPhone: activar Modo desarrollador (para el build nativo).

| Teléfono | Dueño | SO / versión | SDK de Expo Go |
|---|---|---|---|
| iPhone 1 | | | |
| iPhone 2 | | | |
| Android 1 | | | |
| Android 2 | | | |

## 6. Equipo

- [ ] Canal de comunicación y hora fija de la sincronización diaria (10 min).
- [ ] Importar tareas F1–F4 al GitHub Project con responsable según `docs/CRONOGRAMA.md`.
- [ ] Todos leyeron `CLAUDE.md`, `docs/PLAN.md` y `docs/CRONOGRAMA.md`.
