# F4-04 — UI del chat (pantalla inicial de la app)

Fecha: 2026-10-11 · Responsable: Joaquín · Rama: `fase-4/f4-04-chat-ui` (sobre F4-03) · Gasto de IA: USD 0

La pestaña «Chat», que es la ruta inicial tras el login, ahora conversa con `POST /chat`. Muestra:
- un saludo con la ubicación simulada y cuatro sugerencias, una por caso del enunciado;
- respuestas por bloques, cada uno con su chip de certeza heredado y chips de fuente que abren `news/[id]`;
- el aviso del Worker destacado, el pie de procedencia y el botón «¿Cómo se generó?»;
- los estados «buscando», sin red (con «Reintentar»), límite por hora, sesión expirada y chat pausado;
- el texto «Esta conversación no se guarda» y el botón «Nueva conversación».

Decisiones en [CHAT-RAG §4](../docs/domain/CHAT-RAG.md) («Implementación (F4-04)»).

| Archivo | Qué hace |
|---|---|
| `apps/mobile/app/(tabs)/chat.tsx` | Pantalla: saludo, sugerencias, mensajes, estados, composición |
| `apps/mobile/src/chat/ChatViews.tsx` | Burbujas, bloques, chips, aviso, pie, panel «¿Cómo se generó?», errores |
| `apps/mobile/src/chat/presentation.ts` | Sugerencias, historial (≤ 6 turnos), etiquetas, pie, traza, tema del chat |
| `apps/mobile/src/chat/useChat.ts` | Estado en memoria, envío con token, reintento, «Nueva conversación», `chat_topic` |
| `apps/mobile/src/services/chatApi.ts` | `POST /chat` con validación zod de la respuesta y errores tipados |
| `apps/mobile/src/services/chatTopic.ts` | Evento `chat_topic` y señal de interés en una transacción |
| `packages/shared/src/config/api.ts` | URL pública del Worker (`EXPO_PUBLIC_API_URL` la sobrescribe) |

## Criterios de aceptación

| Criterio | Estado | Evidencia |
|---|---|---|
| CA1: los 4 casos del enunciado funcionan en iPhone y Android | ◐ parcial | Worker desplegado en `live` con Haiku 5.5. Probado en un iPhone 16 Pro Max (iOS 27.0.1, Expo Go 1.0.0, cliente 57.0.9, SDK 57.0.0) el 2026-10-12: las 4 sugerencias, el chip de fuente que abre la noticia y «¿Cómo se generó?» funcionan (ver «Registro de prueba en teléfono»). **Falta** probar en un Android y guardar las capturas en el repo |
| CA2: toda respuesta con LLM muestra fuentes y pie de IA; toda abstención lo dice explícitamente | ☑ automatizado | `firebase-tests/chatComponent.test.js`: una respuesta con LLM muestra el texto, el chip «En desarrollo», el chip de fuente «Abrir noticia: …» con sus medios, el aviso y el pie «Respuesta generada con IA a partir de 1 noticia publicada · mock»; una abstención muestra el aviso «No encontré noticias publicadas sobre eso» y el pie «Sin IA: no se encontraron noticias publicadas que respondan esto». `chatPresentation.test.ts` cubre el pie de los cinco modos |

Otras pruebas (20 en total):
- **`chatPresentation.test.ts`:** cuatro sugerencias con un país distinto al del lector y un tema con noticias, y textos de reserva si no hay noticias; saludo con la ubicación; historial de 6 turnos; etiqueta `mixta` con la certeza más baja; traza sin `debug` (como en demo); tema del chat solo en respuestas con modelo.
- **Cliente HTTP:** envía el token; valida la respuesta contra el contrato; mapea 429, 401 y 5xx; detecta errores de red y respuestas fuera de contrato.
- **`chatComponent.test.js`:** panel «¿Cómo se generó?» con intención, noticias, origen y costo; «Reintentar» solo en errores de red o del servidor; cuatro sugerencias como botones.
- **`chatTopic.test.ts`** (emulador con las reglas reales): `chat_topic` sube el interés en 0.5 y registra el evento; un tema fuera del catálogo no escribe nada.

```text
pnpm lint             OK
pnpm typecheck        OK
pnpm test             OK: shared 289, Firestore 80, admin 71, Worker 202 (642 pruebas)
Metro (puerto 8082)   iOS 200 · Android 200; ambos bundles incluyen la pantalla del chat
```

## Registro de prueba en teléfono (2026-10-12)

- **Dispositivo:** iPhone 16 Pro Max, iOS 27.0.1, Expo Go 1.0.0 (cliente 57.0.9, SDK 57.0.0), por túnel
  (`pnpm -F mobile start --tunnel`).
- **Worker:** `news-api.diegovalenzuela.workers.dev`, `aiMode=live`, modelo `claude-haiku-5-5`.
- **Reportado como correcto por Diego** (sin captura guardada en el repo):
  - «Resume lo más importante de hoy» (digest) en Quetzaltenango, con chips de certeza, fuentes y el pie «Resumen
    generado con IA a partir de 4 noticias publicadas · modelo» (captura de pantalla de la sesión, con el modelo anterior).
  - «¿Hay algún festival en mi ciudad?» en Quetzaltenango y «¿Qué pasa en mi ciudad con el transporte público?» en CDMX,
    con `chat.v2` (ver [LOOP-016](loops/LOOP-016-ubicacion-del-lector-en-el-prompt.md)).
  - Una pregunta fuera del corpus («¿Quién ganó el mundial de 2030?») se abstiene con «No encontré noticias publicadas
    sobre eso».
- **Observación de la prueba:** escribir «¿Cómo se generó?» como pregunta se abstiene; es un botón de la tarjeta, no una
  pregunta sobre noticias.
- **Reportado como correcto por Diego (2026-10-12, noche):**
  - Las cuatro sugerencias del chat, una por una.
  - Tocar un chip de fuente abre la noticia.
  - «¿Cómo se generó?» funciona: la captura de la sesión (Ciudad de México, pregunta sobre el sismo de Guatemala) muestra
    «Intención detectada: Noticias de otro país», «Origen: Generada ahora con claude-haiku-5-5», «Costo aproximado:
    ≈ USD 0.0004» y «Noticias usadas (1)», con el pie «Respuesta generada con IA a partir de 1 noticia publicada ·
    claude-haiku-5-5» y los chips «En desarrollo».
- **Pendiente:** recorrido en un Android (Diego lo hará en los próximos días) y las capturas por caso, que se guardarán
  en `evidence/captures/` cuando termine el ajuste de la interfaz.

## Para cerrar CA1

1. Desplegar el Worker con F4-01 a F4-04 (`pnpm -F api run deploy`). Cambia el Worker que usa todo el equipo:
   decidirlo antes.
2. Con `AI_MODE=mock`, «Resume lo más importante de hoy» y «¿Qué pasa en mi zona?» responden con el digest
   simulado; «otro país» y «tema» se abstienen, porque los embeddings simulados no relacionan textos distintos. Para
   ver los cuatro casos reales hace falta `AI_MODE=live` (gasta créditos: ≈ USD 0.004 por respuesta nueva y
   ≈ USD 0.03 por calentar los 8 digests).
3. `pnpm -F mobile start --tunnel`, abrir en Expo Go en un iPhone y en un Android, recorrer las cuatro sugerencias,
   tocar un chip de fuente, abrir «¿Cómo se generó?» y forzar una abstención. Registrar modelo, sistema, versión de
   Expo Go y capturas por caso.
