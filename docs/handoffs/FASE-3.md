# Handoff FASE-3 → FASE-4 (por completar al cerrar la fase 3)

Responsable: Nelson · Estado: **en curso** · Fecha de cierre y tag: pendientes

## 1. Qué quedó funcionando (demostrable)
- F3-02: `rankFeed` puro en `@repo/shared`, configuración con defaults y métricas de diversidad.
- F3-03: cada ítem de `rankFeed` incluye 1–3 explicaciones por código, ordenadas por contribución efectiva.
- F3-08, paso 1: `updateInterests` puro con deltas, límites, silencios, reinicio y decaimiento diario.
- F3-01: servicio móvil con listeners de `config/public`, noticias publicadas y perfil propio; el hook del
  feed expone carga, vacío, error, reintento, noticias únicas y configuración. El servicio está verificado
  contra el emulador con una publicación real de `publishNews`.
- F3-04: pantalla de Noticias conectada al servicio F3-01 y a `rankFeed`, con esenciales, cuatro tiers,
  ubicación simulada, chips, pies de imagen, actualización al deslizar y estados de carga/vacío/error.
  Pendiente validar su presentación en Expo Go. La fase no está cerrada.
- F3-05: portada móvil desde el mismo `buildCoverSpec` del portal; cada imagen lleva pie y una hoja táctil
  de procedencia. Ilustraciones IA tienen sello y advertencia; compactas usan ícono con tooltip. Pendiente
  revisión en Expo Go con teléfono real.
- F3-06: botón «?» en todos los tiers y esenciales, hoja con razones y aportes reales, evento `why_opened`
  y botones «Más/Menos» que guardan preferencias y evento en una transacción. Pendiente revisión en Expo Go.

## 2. Cómo correrlo desde cero
Con Node 24 y pnpm 11.6.0:

```bash
pnpm install --frozen-lockfile
pnpm lint && pnpm typecheck
pnpm -F @repo/shared test
pnpm -F @repo/shared exec tsx scripts/benchmark-ranking.ts
pnpm -F firebase-tests test
pnpm -F mobile start
```

El ranking no requiere variables de entorno, Firestore, Worker ni créditos. El benchmark anterior es de
escritorio, no sustituye CA2 en teléfono. Integración Expo Go: pendiente de las siguientes tareas.

## 3. Estado de tareas
| ID | Estado | Evidencia | Nota |
|----|--------|-----------|------|
| F3-02 | ◐ | [Evidencia](../../evidence/F3-02-ranking.md), [LOOP-009](../../evidence/loops/LOOP-009-ranking-cuotas-y-diversidad.md) | CA1 automatizado; CA2 pendiente en teléfono real |
| F3-03 | ☑ | [Evidencia](../../evidence/F3-03-explanations.md), [LOOP-010](../../evidence/loops/LOOP-010-catalogo-incompleto-de-razones.md) | CA1 verificado para feed y esenciales de las cuatro personas; panel implementado en F3-06 |
| F3-08 | ◐ | [Evidencia](../../evidence/F3-08-interests.md), [LOOP-011](../../evidence/loops/LOOP-011-reloj-de-decaimiento.md) | Paso 1 y feedback de F3-06 verificados; lectura, debounce, Perfil y CA2/CA3 en la app pendientes |
| F3-01 | ◐ | [Evidencia](../../evidence/F3-01-feed-data.md) | CA1 en emulador (<5 s), falta recorrido del proveedor React en Expo Go |
| F3-04 | ◐ | [Evidencia](../../evidence/F3-04-feed-ui.md) | UI implementada; CA1/CA2/CA3 pendientes de revisión visual en dispositivos reales |
| F3-05 | ◐ | [Evidencia](../../evidence/F3-05-images.md) | Componentes y pruebas completados; falta inspección táctil y visual en teléfono real |
| F3-06 | ◐ | [Evidencia](../../evidence/F3-06-why-panel.md) | CA1 automatizado; falta recorrido táctil/visual en teléfono real |
| F3-07, F3-09 … F3-12 | ☐ | | No implementadas todavía |

## 4. Desviaciones respecto a contratos o docs
- Contratos nuevos de ranking, razones y configuración en `types.ts`/`schemas.ts`, documentados en
  `RELEVANCIA.md`, `MODELO-DATOS.md` y referenciados desde `CONTRATOS-API.md`.
- Modo sin personalización ignora también lecturas para cumplir igualdad de orden entre cuentas.
- `mustKnow` conserva todas las esenciales; límite visual de cinco + «ver todas» corresponde a F3-04.
- Diversidad conserva cuotas y separadores futuros; si no hay temas suficientes, conserva todas las noticias.
- F3-03 amplía `Reason.code` con cuatro explicaciones del aporte dominante y `available` para score cero.
  Se requiere al menos una razón en la salida pública (zod). Contribución = peso efectivo × componente ×
  penalización; esenciales/cuotas reservan un espacio con contribución 0 porque no añaden puntos.
  Tipos, esquemas y documentos de contratos actualizados en la misma tarea.
- F3-08 añade el campo opcional `UserProfile.interestsDecayedAt`: nuevos perfiles lo inicializan; antiguos
  usan `updatedAt` una vez. Cada 24 h completas reduce los intereses por 0.9 y conserva la fracción restante.
  Las actualizaciones de ubicación o lecturas no deben mover ese reloj. Se valida
  `interestsDecayedAt <= updatedAt <= now`. Clientes lectores deben usar el esquema actualizado.
- `updateInterests({ profile, signal?, now })` aplica decaimiento antes del delta; omitir señal sirve al
  abrir la app. `more_like_this` reactiva un tema, señales pasivas conservan silencios; `unmute` no suma
  puntos y `reset` vacía intereses/silencios. No cambia `UserEvent`, historial ni preferencia de personalización.
- F3-01 usa las consultas indexadas `workflow + publishedAt` y `workflow + importance + publishedAt`.
  `config/public` puede faltar; se usan defaults. La ventana normal es configurable y esenciales conservan
  72 h fijas; se eliminan retractadas y futuras y se deduplican versiones por ID. El servicio se renueva
  cada hora y reevalúa caducidad cada minuto. El perfil cambia de lectura única a `onSnapshot`.
- F3-04 no cambia contratos persistidos. `feed.tsx` usa `rankFeed` directamente con
  `config.rankingWeights` y ubicación del perfil. Los cuatro tiers determinan tarjetas distintas; esenciales
  quedan arriba, cinco visibles y opción de desplegar todas. Toda imagen visible tiene pie. La imagen de
  portada usa `buildCoverSpec`; el detalle de procedencia de la imagen se completa en F3-05.
- F3-05 no cambia contratos persistidos. `NewsImage` usa `imageCaption` para los cuatro tipos y la portada
  usa `buildCoverSpec`/`wrapCoverTitle`, con la leyenda también dentro de la imagen. La hoja utiliza
  `Modal` y `Linking` de React Native, compatibles con Expo Go; URLs de origen solo se abren si son http(s).
- F3-06 no cambia esquemas persistidos. `normalizeWeights` se exporta para que las barras coincidan con
  `rankFeed`. `why_opened` se añade sin tocar el perfil; «Más/Menos» lee el perfil vigente en una transacción,
  actualiza solo intereses/silencios/reloj y añade el evento de forma atómica. El listener de F3-01 refresca
  el ranking. La integración con señales de lectura y debounce sigue siendo F3-08.

## 5. Deuda y problemas conocidos
- Alta: CA2 de F3-02 sin medir en Expo Go sobre teléfono de gama media; no marcar Done todavía.
- Media: revisar F3-06 en Expo Go: botón «?» en los cinco tipos de tarjeta, hoja, barras, guardado de
  «Más/Menos» y cambio visible del orden. Las garantías tienen contribución 0 porque son reglas de inclusión.
- Media: validar F3-01 en Expo Go en un teléfono real al conectar el hook a F3-04. El emulador ya verificó
  la publicación del portal y las reglas; falta comprobar el proveedor React y navegación real en dispositivo.
- Alta: revisar F3-04 en Expo Go en iPhone pequeño y Android grande. Los tests de corpus prueban orden,
  tiers y etiquetas; no prueban tamaño, recortes ni accesibilidad visual en ambos dispositivos.
- Media: revisar F3-05 en Expo Go: portada, pie, sello IA cuando haya ejemplo, hoja de procedencia y tooltip
  compacto; registrar teléfono y evidencia. El corpus semilla solo incluye portada y licencia libre.
- Media: datos editoriales pueden quedar fuera de ventana. Nelson reportó una noticia publicada y pausó
  las restantes; no se modificó ningún checklist ni noticia desde el agente.
- Media: completar F3-08 después de lectura: mapear `open`/`dwell` a señales, mantener `readNewsIds`,
  deduplicar y persistir el perfil con debounce (un write por sesión) sin sobrescribir cambios concurrentes.
  Añadir controles de Perfil y validar CA2/CA3 en Expo Go. Las cuatro pruebas de integración pura con
  `rankFeed` no sustituyen esa evidencia visible.

## 6. Gasto de IA de la fase
F3-01, F3-02, F3-03, F3-04, F3-05, F3-06 y función pura de F3-08: USD 0 en llamadas a modelos desde este trabajo; no se invocaron proveedores reales ni el gateway desplegado.
Ledger/panel del proveedor: no consultados para esta tarea. Total de fase se verificará al cierre.

## 7. Qué necesita saber la siguiente persona antes de empezar
1. App y comparador deben importar el mismo `rankFeed` con las mismas entradas y `now` para obtener el mismo orden.
2. Esenciales no dependen del perfil; retractadas nunca aparecen en los bloques, pero F3-07 debe admitir enlace directo.
3. Pruebas automáticas y benchmark de escritorio no reemplazan evidencia de Expo Go en teléfono real.

## 8. Loops registrados en esta fase
- [LOOP-009](../../evidence/loops/LOOP-009-ranking-cuotas-y-diversidad.md): conservar cuotas y separadores al diversificar.
- [LOOP-010](../../evidence/loops/LOOP-010-catalogo-incompleto-de-razones.md): explicar noticias que no cumplen ningún umbral del catálogo original sin atribuirles condiciones falsas.
- [LOOP-011](../../evidence/loops/LOOP-011-reloj-de-decaimiento.md): separar el reloj de decaimiento de otras actualizaciones del perfil; regresión comprobada sustituyendo temporalmente el reloj.
