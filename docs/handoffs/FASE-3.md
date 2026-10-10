# Handoff FASE-3 → FASE-4

Responsable: Nelson · Estado: **F3-01 a F3-11 integradas; cierre F3-12 en curso** · Fecha de cierre y tag `fase-3-done`: pendientes

Nelson informó el 2026-10-10 que probó la app y que «todo funciona bien». El [registro de prueba](../../evidence/F3-12-manual-review.md) distingue ese reporte de los criterios que aún necesitan modelo de teléfono, tiempos o capturas. La fase no se declara cerrada por un reporte general.

## 1. Qué quedó funcionando (demostrable)

- **F3-01 a F3-04:** la app escucha noticias publicadas y `config/public` en Firestore; excluye retractadas del feed; aplica `rankFeed` de `@repo/shared` según la ubicación **simulada**; muestra esenciales, cuatro niveles de tarjeta y razones «¿Por qué veo esto?». El ranking y las explicaciones son código local, sin modelos.
- **F3-05/06:** portada tipográfica compartida con el portal, pie y detalle de procedencia de cada imagen; panel «¿Por qué veo esto?» con contribuciones y controles «Más/Menos como esto» que guardan preferencias.
- **F3-07/08:** lectura con fuentes, certeza, correcciones, versiones, afirmaciones y etiquetas de IA. Una retractada sigue accesible por enlace directo, con aviso rojo y texto tachado. La app registra apertura y permanencia, aprende intereses y ofrece controles en Perfil.
- **F3-09/10:** cambiar ciudad simulada reordena el feed antes de esperar a Firestore; una publicación nueva en top 3 o esenciales activa «Nueva noticia».
- **F3-11:** `/compare` en el portal usa el mismo `rankFeed` para ocho ciudades y cuatro perfiles, con posición/nivel, esenciales y diversidad. Escucha publicaciones y configuración en tiempo real. `/comparador` redirige a `/compare`.
- Chat y búsqueda conversacional pertenecen a Fase 4; feed, lectura y comparador no necesitan el Worker ni créditos de IA.

## 2. Cómo correrlo desde cero

Requisitos: Node 24, pnpm 11.6.0, Expo Go compatible con SDK 57, teléfono real y acceso a Firebase. En Linux con nvm, activar Node 24 antes de usar pnpm; en la máquina de Nelson, Node 20 no lo encuentra en `PATH`.

```bash
git clone https://github.com/newsappequipo7/RAI-Project2.git
cd RAI-Project2
nvm use 24                         # instalar Node 24 antes si aún no está disponible
corepack enable                    # expone pnpm si aún no está en PATH
node --version && pnpm --version   # esperado: Node 24 y pnpm 11.6.0
pnpm install --frozen-lockfile
pnpm lint && pnpm typecheck && pnpm test
pnpm -F mobile start --tunnel
```

Abrir el QR de Metro en Expo Go, iniciar sesión con Google, elegir una de las ocho ciudades simuladas y entrar a «Noticias». Abrir una tarjeta para leerla, usar «?» para entender el orden y Perfil para personalización. El login móvil usa el puente web desplegado en `/auth/mobile`. Si falla el túnel, reintentar o usar LAN/hotspot. La app apunta al Firestore del proyecto mediante la configuración **pública** de `@repo/shared`; no necesita `.env` ni clave de IA.

En otra terminal, para comparar con los mismos datos publicados:

```bash
pnpm -F admin dev
```

Abrir `http://localhost:5173/compare` e iniciar sesión con una cuenta cuyo UID esté en `admins/{uid}`. El portal usa Firestore del proyecto por defecto. `E1`, `E2`… son posiciones en «Lo que debes saber»; las demás son posiciones del feed. «—» significa que la noticia no aparece en el ranking actual. Seleccionar una noticia para seguirla entre ciudades; cambiar el perfil de prueba para ver otro orden. El panel inferior muestra diversidad de los primeros diez lugares. Si no hay noticias recientes, revisar la ventana de recencia antes de concluir que falló la suscripción.

Variables opcionales del portal (ver `apps/admin/.env.example`): `VITE_API_URL` cambia el Worker; `VITE_EXPO_PROJECT_URL` alimenta el QR de «Instalar»; `VITE_CLOUDINARY_CLOUD_NAME` y `VITE_CLOUDINARY_UPLOAD_PRESET` habilitan subida de imágenes. `VITE_AUTH_EMULATOR` y `VITE_FIRESTORE_EMULATOR` son solo para desarrollo local del portal y no deben activarse al compararlo con la app móvil conectada a producción. Ninguna variable de cliente contiene claves de proveedores de IA.

`pnpm test` levanta el emulador de Firestore y ejecuta pruebas con IA en mock. `pnpm seed --target=emulator` carga las 40 noticias semilla para explorar datos en ese emulador; no modifica producción. Las noticias editoriales reales se publican únicamente tras revisión humana en el portal. No publicar `demo-d1` ni `demo-d2`.

## 3. Estado de tareas

`☑` = criterios verificados con evidencia; `◐` = código integrado, pero falta evidencia específica. Detalle en [PLAN.md §6](../PLAN.md). El reporte manual general de Nelson está en [F3-12](../../evidence/F3-12-manual-review.md), sin atribuirle tiempos o dispositivos no registrados.

| ID | Estado | Evidencia | Falta para cierre |
|---|---|---|---|
| F3-01 | ◐ | [Feed y emulador](../../evidence/F3-01-feed-data.md) | Identificar teléfono y recorrido del feed en Expo Go. |
| F3-02 | ◐ | [9 pruebas y benchmark de escritorio](../../evidence/F3-02-ranking.md) | Medir 200 noticias en <20 ms en teléfono de gama media. |
| F3-03 | ☑ | [Explicaciones](../../evidence/F3-03-explanations.md) | CA automatizado verificado. |
| F3-04 | ◐ | [Jerarquía visual](../../evidence/F3-04-feed-ui.md) | Capturas y revisión de cuatro perfiles, chips y tamaños en iPhone pequeño y Android grande. |
| F3-05 | ◐ | [Imágenes](../../evidence/F3-05-images.md) | Registrar teléfono y revisión de pies y procedencia. |
| F3-06 | ◐ | [Panel «¿Por qué?»](../../evidence/F3-06-why-panel.md) | Registrar recorrido en Expo Go y efecto visible de «Menos». |
| F3-07 | ◐ | [Lectura y procedencia](../../evidence/F3-07-reading-provenance.md) | Capturas de las cuatro certezas y etiquetas IA en teléfono. |
| F3-08 | ◐ | [Intereses y señales](../../evidence/F3-08-interests.md) | Evidencia tras tres lecturas y comparación de dos cuentas sin personalización. |
| F3-09 | ◐ | [Cambio de ubicación](../../evidence/F3-09-hot-location.md) | Medir toque → feed actualizado en <300 ms en teléfono real. |
| F3-10 | ◐ | [Tiempo real](../../evidence/F3-10-live-alerts.md) | Medir publicación → indicador en <5 s en dos teléfonos; tarjeta de corrección `[PLUS]` pendiente. |
| F3-11 | ◐ | [Comparador](../../evidence/F3-11-comparator.md) | Captura/revisión visual del portal con cuatro perfiles; CA1/CA2 automatizados. |
| F3-12 | ◐ | [Registro de cierre](../../evidence/F3-12-manual-review.md) | Pulido y evidencia de accesibilidad, videos, recorrido de Joaquín siguiendo este handoff y tag autorizado. |

## 4. Desviaciones respecto a contratos o docs

- `rankFeed`, razones y pesos/defaults de `config/public` viven en `@repo/shared`; tipos, zod y [RELEVANCIA](../domain/RELEVANCIA.md) están actualizados. Sin personalización se ignoran intereses e historial para igualar el orden entre cuentas de la misma ciudad. Esenciales usan hasta 72 h aunque la ventana normal sea configurable.
- `UserProfile.interestsDecayedAt` es opcional para perfiles antiguos. `updateInterests` aplica decaimiento diario antes de cada señal; las transacciones de lectura y Perfil preservan cambios concurrentes. Ver [MODELO-DATOS](../architecture/MODELO-DATOS.md).
- F3-07 lee directamente una retractada aunque ya no aparezca en el feed. Consulta versiones solo tras confirmar que la noticia es pública. El resumen IA solo se muestra si fue aprobado y se etiqueta con el editor.
- F3-09 no usa GPS. F3-10 detecta IDs prominentes en la suscripción existente. F3-11 usa el mismo motor y pesos que la app; su consulta del portal exige `workflow == 'publicada'` y no invoca al Worker.
- Los contratos cambiados durante la fase se documentaron en `docs/architecture/`, `docs/domain/`, tipos y esquemas. Esta actualización del handoff no cambia contratos.

## 5. Deuda y problemas conocidos

| Severidad | Pendiente | Acción |
|---|---|---|
| Alta | Evidencia de Expo Go incompleta aunque Nelson reportó que la app funciona | Anotar modelo, sistema, versión de Expo Go, flujo, resultado y capturas/videos por criterio; no inventar tiempos. |
| Alta | Ventana de feed de 72 h por defecto: las fechas relativas de semilla caducan | Para demo, acordar `config/public.feedWindowHours` o preparar/publicar noticias recientes; usar seed solo en emulador para pruebas locales. |
| Media | F3-12 aún no tiene evidencia de modo oscuro, texto dinámico, contraste AA ni videos requeridos | Revisar en dispositivos, guardar evidencia y corregir UI si alguna prueba falla. |
| Media | No consta recorrido de Joaquín siguiendo exclusivamente este handoff | Hacerlo y corregir pasos que no pueda reproducir antes del tag. |
| Media | F3-02, F3-09 y F3-10 exigen umbrales medidos en teléfono(s) | Registrar datos reales; escritorio y emulador no sustituyen esas mediciones. |
| Baja | F3-10 marca la tarjeta de noticias corregidas como `[PLUS]` | Implementar solo si se decide incluirla. |

## 6. Gasto de IA de la fase

Feed, lectura, ranking y comparador no llaman a modelos; el Worker se probó en mock. **Gasto observado en este trabajo: USD 0 en llamadas de IA**. Aquí no se consultaron el ledger ni el panel del proveedor, así que el total externo de la fase, la diferencia entre fuentes y el costo medio por tarea no están reconciliados. Registrar esos valores si se requiere un cierre financiero formal; no estimarlos desde los tests.

## 7. Qué necesita saber la siguiente persona antes de empezar

1. El chat de Fase 4 debe heredar noticias, certeza y fuentes publicadas; no debe calcular por IA la certeza ni alterar `rankFeed`. Una retractada no está en el feed, pero existe por enlace directo y conserva historial.
2. Para reproducir app y comparador juntos, ambos deben leer el mismo Firestore y usar perfil neutro, ciudad, `config/public` y momento de cálculo equivalentes. `/compare` ofrece las ocho ciudades y un perfil sin historial por defecto.
3. F3-01 a F3-11 están en `main`; los ◐ indican evidencia específica pendiente, no tareas por reimplementar. No hay tag `fase-3-done` ni aceptación del handoff por Joaquín todavía.

## 8. Loops registrados en esta fase

- [LOOP-009](../../evidence/loops/LOOP-009-ranking-cuotas-y-diversidad.md): cuotas y diversidad.
- [LOOP-010](../../evidence/loops/LOOP-010-catalogo-incompleto-de-razones.md): razones fieles a las contribuciones.
- [LOOP-011](../../evidence/loops/LOOP-011-reloj-de-decaimiento.md): reloj independiente para intereses.
- [LOOP-012](../../evidence/loops/LOOP-012-ubicacion-prueba-aislada.md): cambio de ubicación y prueba aislada.
