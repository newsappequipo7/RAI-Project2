# Distribución en iPhone y Android sin tiendas ni cuenta Apple de pago

Restricción: nadie tiene Apple Developer Program (USD 99/año) y el presupuesto lo prohíbe.
Objetivo: que el equipo **y compañeros** usen la app en iPhone y Android durante la clase.

## 1. Resumen de planes

| Plan | Cómo | Quién puede usarlo | Pros | Contras |
|---|---|---|---|---|
| **A (principal)** | Expo Go (App Store / Play Store) + nuestro proyecto servido por Metro con túnel o por EAS Update | Cualquiera con Expo Go instalado; se abre con QR | Gratis, sin firma, sin USB, funciona en iOS y Android, actualizaciones instantáneas | Solo módulos incluidos en Expo Go; la versión de SDK debe ser la que soporte Expo Go en la tienda; depende de red |
| **B (respaldo nativo)** | `expo prebuild` → build en **Xcode desde una MacBook del equipo** firmado con el Apple ID gratuito del equipo, instalado por USB | Los 2 iPhone del equipo | App "real" con ícono propio, no depende de Expo Go ni de GitHub Actions | Firma gratuita de Apple: la app caduca en pocos días (7 según las reglas conocidas del aprovisionamiento gratuito; verificar), límite de apps por dispositivo, requiere USB y Modo desarrollador |
| **C (emergencia)** | `expo export -p web` publicado en Firebase Hosting (PWA) | Cualquiera con navegador | Cero instalación | No es app nativa; el enunciado pide app móvil: usar solo si A y B fallan |

Android sin tienda: además de Expo Go, se puede generar un APK con EAS Build (plan gratuito de Expo, verificar cupo) o
localmente con `npx expo run:android --variant release` y compartir el archivo.

## 2. Plan A — Expo Go (tareas F1-02)

1. **Antes de crear el proyecto**, instalar Expo Go en un iPhone y ver qué versión de SDK soporta. Crear el proyecto
   con esa versión exacta (`npx create-expo-app@latest` con la plantilla del SDK soportado). Si Expo actualiza Expo Go
   durante el semestre, no actualizar el SDK del proyecto hasta verificar que la versión de la tienda lo soporta.
2. Dependencias permitidas: las incluidas en Expo Go (`expo-router`, `expo-web-browser`, `expo-linking`,
   `expo-image`, `@react-native-async-storage/async-storage`, `expo-haptics`, etc.) y librerías JS puras
   (`firebase` JS SDK, `zod`, `date-fns`). Verificar cada librería nueva con `npx expo install` y probar en Expo Go.
3. Servir el proyecto:
   - Desarrollo: `npx expo start --tunnel` (las redes universitarias suelen aislar clientes; el túnel lo evita).
   - Demo: publicar con EAS Update y abrir desde Expo Go con el enlace/QR (verificar en F1-02 que Expo Go puede cargar
     la actualización publicada para nuestro proyecto; si no, usar túnel desde una laptop con hotspot propio).
4. Generar una página simple (`apps/admin/src/routes/instalar/`) con: enlaces a Expo Go en ambas tiendas, QR del
   proyecto y 3 pasos. Es lo que se proyecta en clase para que los compañeros entren.

## 3. Login con Google en Expo Go: puente web (tareas F1-03)

Expo Go no incluye el SDK nativo de Google Sign-In, así que:

1. La app construye `redirectUri = Linking.createURL('auth')` (en Expo Go será `exp://…/--/auth`; en build nativo,
   `newsapp://auth`).
2. Abre con `WebBrowser.openAuthSessionAsync(BRIDGE_URL + '?redirect=' + encodeURIComponent(redirectUri), redirectUri)`.
3. La página puente (`apps/admin/src/routes/auth/mobile/+page.svelte`, servida en `https://<proyecto>.web.app`):
   - Valida `redirect` contra una **lista blanca** de prefijos (`exp://`, `newsapp://`). Si no coincide, muestra error y
     no autentica. Esto evita que un enlace malicioso reciba el token.
   - Ejecuta `signInWithRedirect(auth, new GoogleAuthProvider())` y luego `getRedirectResult`.
   - Obtiene `GoogleAuthProvider.credentialFromResult(result).idToken`.
   - Redirige a `redirect + '#id_token=' + idToken` (fragmento, no query: no queda en logs de servidor).
   - Hace `signOut` del lado web para no dejar sesión en el navegador compartido.
4. La app recibe la URL, extrae el token del fragmento y ejecuta
   `signInWithCredential(auth, GoogleAuthProvider.credential(idToken))`.
5. Persistencia de sesión en la app con `initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })`.

Configuración de Firebase necesaria: habilitar proveedor Google; agregar el dominio de Hosting a dominios autorizados.

Riesgos a probar explícitamente en el spike:
- Que el navegador de sistema de iOS permita el flujo de redirect de Firebase (si falla, probar `signInWithPopup` en la
  página puente).
- Que la redirección a `exp://` regrese a Expo Go en iOS y Android.
- Que el `id_token` de Google sea aceptado por `signInWithCredential` (vigencia ~1 h, se canjea de inmediato).

Criterio de salida del spike: dos personas distintas inician sesión en un iPhone y un Android reales, y cierran/abren
la app sin volver a loguearse. Grabar video corto como evidencia.

## 4. Plan B — build nativo con Xcode (tareas F1-04)

El equipo tiene MacBooks, así que el camino directo es Xcode con el Apple ID gratuito del equipo:

1. Rama `native-build`: `npx expo prebuild -p ios` (esquema `newsapp`).
2. Abrir `ios/*.xcworkspace` en Xcode → Signing & Capabilities → Team = Apple ID del equipo (Personal Team) →
   bundle id único (p. ej. `gt.uvg.newsapp.<iniciales>`).
3. Conectar el iPhone por USB, Modo desarrollador activo, compilar en configuración Release (bundle JS embebido,
   no necesita Metro).
4. En el iPhone: Ajustes → General → VPN y gestión de dispositivos → confiar en el desarrollador.
5. Repetir con el segundo iPhone. Reinstalar ≤ 3 días antes de la presentación.

Alternativa documentada (no necesaria con Mac): ios-builder + MobAI, descrita abajo. Se deja por si el día de la
demo no hay Mac disponible.

### 4.1 Alternativa sin Mac: ios-builder + MobAI

Referencia: <https://github.com/MobAI-App/ios-builder> y <https://mobai.run>.

Qué hace (según su README): CLI que compila apps iOS sin Mac usando GitHub Actions con runners macOS, descarga el IPA,
y usa MobAI (app de escritorio para Windows/Linux/macOS) para instalarlo en un iPhone real. Detecta proyectos
"Expo (ejected)" en `ios/`. Por defecto genera IPAs **sin firmar**; MobAI re-firma usando una cuenta de iCloud
(recomiendan crear una cuenta nueva, no la personal) y el bundle id queda con sufijo del team.

Pasos:
1. En una rama `native-build`, `npx expo prebuild -p ios` para generar `ios/` (no commitear `ios/` en `main`).
2. Instalar `builder` (release para Windows o `install.sh` en Linux/macOS/WSL), `builder auth github`, `builder init`.
3. `builder ios build` → IPA en `./dist/`.
4. Instalar MobAI (plan Free: 1 dispositivo a la vez), conectar el iPhone por USB, activar Modo desarrollador en el
   iPhone, instalar el IPA re-firmado con el Apple ID de equipo.
5. En el iPhone: Ajustes → General → VPN y gestión de dispositivos → confiar en el desarrollador.

Consideraciones:
- Minutos de GitHub Actions: el README indica que el plan gratuito da 2 000 min/mes con multiplicador ×10 en macOS
  (≈ 15–20 builds). Esto aplica a repos privados; para repos públicos los runners estándar suelen ser gratuitos
  (verificar política vigente de GitHub). Compilar solo cuando cambie código nativo o para la versión final.
- Reinstalar **dentro de los días previos a la presentación** para que la firma gratuita no caduque durante la demo.
- El login usa el mismo puente web (esquema `newsapp://`), sin módulos nativos extra.
- Valor para la presentación: demuestra que la app corre como binario nativo en iPhone, no solo dentro de Expo Go.

`[PLUS]` MobAI expone un servidor MCP (`npx mobai-mcp`) que permite a Claude Code manejar el teléfono (tocar, capturar
pantalla). Se puede usar en F3/F4 para pruebas de UI automatizadas y para grabar evidencia de flujos.

## 5. Checklist del día de la demo

- [ ] Laptop con Metro/túnel lista + hotspot propio probado.
- [ ] Actualización EAS publicada (o túnel activo) con la versión final.
- [ ] Los 2 iPhones del equipo con Plan B (Xcode) instalado hace < 3 días, por si Expo Go falla.
- [ ] Página `/instalar` proyectable con QR.
- [ ] Video de respaldo de cada flujo (ver DEMO-RUNBOOK.md).
