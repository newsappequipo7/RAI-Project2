# F3-06 — «¿Por qué veo esto?» y control del feed

Estado: **◐**. Panel, eventos y controles implementados; falta recorrido en Expo Go con teléfono real.

## Resultado

- Cada tarjeta del feed, incluidas las esenciales, tiene botón «?». Una hoja inferior muestra las 1–3 razones de `rankFeed`, cuatro barras de aporte efectivo al puntaje y los botones «Más como esto» y «Menos de esto».
- La barra usa los mismos pesos normalizados y la penalización de lectura que el ranking. Las esenciales muestran afinidad 0 y una nota que explica por qué no se ocultan.
- Abrir la hoja crea un evento `why_opened` en `users/{uid}/events`. Los botones guardan el evento y la transición de `updateInterests` en una transacción que lee el perfil vigente y actualiza solo intereses, silencios y sus relojes. El listener del perfil provoca el siguiente ranking.
- No hay llamadas a modelos, cambios de esquema persistido ni módulos nativos nuevos.

## Criterio de aceptación

| Criterio | Evidencia | Pendiente |
|---|---|---|
| «Menos de esto» baja noticias del tema en el siguiente ranking, sin sacar esenciales | `firebase-tests/whyPanel.test.ts` compara `rankFeed` antes/después. `firebase-tests/feedFeedback.test.ts` prueba la escritura con reglas reales, conserva una ubicación cambiada y compara el ranking del perfil resultante. | Confirmar el cambio visible tras tocar el botón en Expo Go. |
| Razones, barras y controles visibles; `why_opened` registrado | `firebase-tests/whyPanelComponent.test.js` renderiza razones, cuatro barras, dos botones y aviso esencial; el test del emulador comprueba el evento sin cambio de perfil. | Verificar apertura, cierre, desplazamiento y pulsación en teléfono. |

## Verificación

- `pnpm lint` y `pnpm typecheck`: verdes.
- `pnpm test`: 525 pruebas verdes (shared 258, Firestore 52, portal 71, Worker 144) antes de la última aserción de ranking persistido; se repitió el test de integración después de añadirla.
- Exportaciones de Expo para Android e iOS: exitosas (`/tmp/f3-06-android`, `/tmp/f3-06-ios`).

Para cerrar en un teléfono real: abrir una tarjeta normal y una esencial, comprobar razones y barras; tocar «Menos de esto» en una noticia de un tema con varias publicaciones y comprobar que sus puntajes/orden bajen al recargar, mientras «Lo que debes saber» sigue visible. Registrar modelo, sistema, resultado y video/captura. El corpus semilla queda fuera de la ventana de 72 h si no se vuelve a sembrar o ampliar la configuración; usar noticias publicadas recientes para esa comprobación. No se modificaron noticias ni checklist editoriales.
