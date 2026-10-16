# Capturas y mediciones pendientes — recorrido único con los teléfonos

Fecha de la lista: 2026-10-15. Se hace en **una sola pasada**, en este orden. Marca cada casilla cuando el archivo ya esté
copiado al repo. Capturas y videos de prueba: `evidence/captures/`. Videos de respaldo de la demo: `evidence/demo-videos/`.

Teléfonos: **iPhone** = iPhone 16 Pro Max (iOS 27.0.1, Expo Go 1.0.0) salvo que se diga otro; **Android** = el que se
use en la demo (anotar modelo y versión de Android en `evidence/F4-10-rehearsals.md`).

## 0. Antes de empezar

- [ ] Worker con `aiMode=live` (`curl <worker>/health`). Expo con `pnpm -F mobile start --tunnel`.
- [ ] Cuentas: A (iPhone) y B (Android), distintas, ambas con Google. Anotar los modelos de los teléfonos.
- [ ] **No retractar `n-ar-003` ni publicar `demo-d1`/`demo-d2` durante este recorrido.** Son para la demo: una vez
  publicadas o retractadas en producción no se pueden devolver a su estado anterior. Ver la decisión abierta al final.
- Costo: cada respuesta nueva del chat cuesta ≈ USD 0.0004 y los digests salen de caché. Las ~12 respuestas de la
  sección 2 suman centavos.

## 1. Login (F1-02, F1-03, F1-11)

- [ ] **F1-02** login Google en Android → `evidence/captures/F1-02-login-android.png` (Android). Si ya existe fuera del
  repo, no repetir: se copia en el Bloque 6 (I8).
- [ ] **F1-11** selector de ubicación simulada, sin GPS → `evidence/captures/F1-11-ubicacion-simulada-iphone.png` (iPhone).

## 2. Chat (F4-04 CA1, I2)

Pantalla inicial en `gt-quetzaltenango`, luego `mx-cdmx`. Una captura por caso y por teléfono.

- [ ] Resumen / mi región («Resume lo más importante de hoy») → `F4-04-chat-resumen-iphone.png` y `F4-04-chat-resumen-android.png`
- [ ] Otro país («Explícame lo más importante de México», desde `gt-guatemala`) → `F4-04-chat-otro-pais-iphone.png` y `…-android.png`
- [ ] Tema («¿Qué se acordó en la cumbre climática?», desde `us-nueva-york`) → `F4-04-chat-tema-iphone.png` y `…-android.png`
- [ ] Incertidumbre: pregunta cuya fuente está «En desarrollo» (lluvias en CDMX, desde `mx-cdmx`), con el chip y el aviso → `F4-04-chat-incertidumbre-iphone.png` y `…-android.png`
- [ ] Abstención («¿Quién ganó el mundial de ajedrez de 1972?») con «Sin IA» y costo 0 → `F4-04-chat-abstencion-iphone.png` y `…-android.png`
- [ ] «¿Cómo se generó?» abierto (intención, noticias usadas, costo) → `F4-04-chat-como-se-genero-iphone.png`
- [ ] Chip de fuente que abre la noticia → `F4-04-chat-fuente-abre-noticia-iphone.png`

## 3. Feed en 3 ubicaciones (F3-04, F3-01)

- [ ] `gt-quetzaltenango` → `F3-04-feed-gt-quetzaltenango-iphone.png`
- [ ] `mx-cdmx` → `F3-04-feed-mx-cdmx-iphone.png`
- [ ] `es-madrid` → `F3-04-feed-es-madrid-iphone.png`
- [ ] **CA3** iPhone pequeño (SE o el más pequeño disponible; anotar modelo) → `F3-04-feed-iphone-pequeno.png`
- [ ] **CA3** Android grande → `F3-04-feed-android-grande.png`
- [ ] «Lo que debes saber» con «Ver todas» → `F3-04-lo-que-debes-saber-iphone.png`

## 4. Pie de imagen por tipo (F3-05)

En producción solo existen dos tipos: `portada_generada` y `licencia_libre`. `foto_propia` e `imagen_ia` no hay (la
ilustración con IA está sin proveedor, ADR-011); se documenta como límite.

- [ ] `portada_generada` (ej. `ed-ar-001`) con su pie → `F3-05-pie-portada-generada-iphone.png`
- [ ] `licencia_libre` (ej. `n-gt-003`) con su pie → `F3-05-pie-licencia-libre-iphone.png`
- [ ] Hoja de detalle al tocar la imagen (tipo, crédito, licencia) → `F3-05-hoja-detalle-imagen-iphone.png`

## 5. «¿Por qué veo esto?» y «Menos de esto» (F3-06)

- [ ] Panel «¿Por qué veo esto?» abierto → `F3-06-por-que-veo-esto-iphone.png`
- [ ] Feed antes de «Menos de esto» en un tema → `F3-06-menos-de-esto-antes-iphone.png`
- [ ] Feed después (el tema baja; «Lo que debes saber» no cambia) → `F3-06-menos-de-esto-despues-iphone.png`

## 6. Las 4 certezas en lectura (F3-07)

- [ ] Confirmada: `ed-gt-001` → `F3-07-confirmada-iphone.png`
- [ ] En desarrollo con nota: `ed-mx-001` → `F3-07-en-desarrollo-iphone.png`
- [ ] Disputada: `n-gt-007` → `F3-07-disputada-iphone.png`
- [ ] Retractada con su corrección: `n-ret-001` → `F3-07-retractada-iphone.png`
- [ ] Fuentes y procedencia desplegadas en una noticia (cuenta como «Cómo se hizo esta noticia») → `F3-07-fuentes-procedencia-iphone.png`

## 7. Aprendizaje de intereses (F3-08)

Solo hay 3 noticias de deportes publicadas (`ed-gt-003`, `n-co-003`, `n-mx-004`): se leen las tres.

- [ ] Feed antes de leer, desde `gt-guatemala` → `F3-08-feed-antes-iphone.png`
- [ ] Feed después de leer las tres (la posición de deportes sube) → `F3-08-feed-despues-iphone.png`
- [ ] **CA3** «Ver sin personalizar» activado en la cuenta A (iPhone) y en la B (Android), **misma ubicación** →
  `F3-08-sin-personalizar-cuenta-a-iphone.png` y `F3-08-sin-personalizar-cuenta-b-android.png` (el orden debe coincidir)

## 8. Cambio de ubicación (F3-09, mide < 300 ms)

- [ ] Video del cambio `gt-guatemala` → `mx-cdmx` filmado con **otro teléfono en cámara lenta (240 fps)**, mostrando
  el dedo y la pantalla → `F3-09-cambio-ubicacion-iphone.mov`
- [ ] Mismo cambio en Android con «Mostrar toques» activado y grabación de pantalla → `F3-09-cambio-ubicacion-android.mp4`
- [ ] Resultado en ms (cuadros entre el toque y el feed nuevo ÷ fps) anotado en `evidence/F3-09-hot-location.md`

## 9. Tiempo real con 2 teléfonos (F3-10, mide < 5 s)

Requiere publicar algo en producción: ver la decisión abierta al final antes de hacerlo.

- [ ] Ambos teléfonos con Noticias abierto; publicar desde el portal; filmar los dos con un reloj visible →
  `F3-10-aviso-iphone.mp4` y `F3-10-aviso-android.mp4`
- [ ] Tiempos (publicación → indicador, por teléfono) anotados en `evidence/F3-10-live-alerts.md`

## 10. Portal: publicar y retractar (F2-06, F2-08, secciones 3 y 7 de la demo)

Ya hay capturas de F2 (`F2-06-*`, `F2-08-*`). Lo nuevo es el video de respaldo; ver la decisión abierta.

- [ ] Publicar una local GT esencial y una internacional rutina → `evidence/demo-videos/03-publicacion-en-vivo.mp4`
- [ ] Retractar en vivo con su corrección y verificar que el chat deja de citarla → `evidence/demo-videos/07-retractacion.mp4`

## 11. Comparador (F3-11)

- [ ] `/compare` en el navegador del portal con sesión admin, con los 4 perfiles → `F3-11-compare-revision-navegador.png`
  (ya existen cinco capturas `F3-11-compare-*.jpg`; esta confirma la revisión visual en el portal real)
- [ ] CA2: publicar desde el portal y ver que `/compare` se actualiza sin recargar → `F3-11-compare-actualiza-sin-recargar.mp4`

## 12. Pulido (F3-12)

- [ ] Modo oscuro en feed y lectura → `F3-12-modo-oscuro-iphone.png`
- [ ] Texto dinámico grande en feed y lectura → `F3-12-texto-dinamico-iphone.png`
- [ ] Contraste AA: no es captura; anotar herramienta y resultado en `evidence/F3-12-manual-review.md`
- No se puede hacer en solitario: el recorrido de Joaquín siguiendo solo el handoff (F3-12 CA1). Queda pendiente.

## 13. Medición de F3-02 CA2: `rankFeed` < 20 ms en teléfono

- [ ] Modelo del teléfono de **gama media** (el iPhone 16 Pro Max no lo es), versión de Expo Go y tiempos →
  `evidence/F3-02-ranking.md`. Método propuesto abajo; requiere tu aprobación del log solo en desarrollo.

## 14. Videos de respaldo (B4), uno por sección del runbook

Carpeta `evidence/demo-videos/`. Priorizar las secciones de riesgo (2, 3, 5, 7).

- [ ] `01-producto-y-alcance.mp4`  - [ ] `02-app-movil.mp4`  - [ ] `03-publicacion-en-vivo.mp4`
- [ ] `04-validacion-companeros.mp4`  - [ ] `05-chat.mp4`  - [ ] `06-arquitectura-y-decisiones.mp4`
- [ ] `07-retractacion.mp4`  - [ ] `08-loops-y-gestion.mp4`  - [ ] `09-costos.mp4`  - [ ] `10-lecciones.mp4`

## Decisión abierta: noticias para publicar y retractar en producción

`demo-d1`, `demo-d2` y `n-ar-003` son las noticias de la demo y no se pueden reutilizar tras publicarlas o retractarlas.
Los puntos 9, 10 y 11 (CA2) necesitan publicar algo en producción. El runbook no dice cómo ensayar sin gastarlas.
Opciones: (A) ensayar la publicación en el emulador y publicar en producción solo el día de la presentación; los
teléfonos no pueden apuntar al emulador, así que el punto 9 no se mediría; (B) crear una noticia de ensayo descartable,
publicarla para medir el punto 9 y después dejarla `rechazada` y fuera del índice.

## Cómo medir sin agregar código a producción

**F3-09 (< 300 ms): no requiere código.** La medición es de extremo a extremo (toque → feed nuevo en pantalla), que es lo
que ve el usuario. Se filma la pantalla con otro teléfono en 240 fps (cada cuadro ≈ 4 ms) y se cuentan los cuadros entre
el toque y el primer cuadro con el feed de la ubicación nueva. En Android basta «Mostrar toques» más la grabación de
pantalla (60 fps, ±17 ms). La prueba `locationChange.test.ts` ya cubre solo el cálculo; este número cubre también el
renderizado.

**F3-02 CA2 (`rankFeed` < 20 ms en 200 noticias): requiere un log solo en desarrollo.** El feed real tiene ≈ 50 noticias,
no 200, y Expo Go no expone el tiempo de una función. Propuesta, **sin aplicar** hasta tu aprobación y en un commit
separado (`__DEV__` es `false` en una compilación de producción, así que no corre en el Plan B nativo de release):

```ts
// apps/mobile/src/feed/devRankingTiming.ts
import { rankFeed } from '@repo/shared';

const BENCHMARK_NEWS_COUNT = 200;
const TIMING_RUNS = 5;

type RankFeedInput = Parameters<typeof rankFeed>[0];

function medianMs(run: () => void): number {
  const durations = Array.from({ length: TIMING_RUNS }, () => {
    const start = performance.now();
    run();
    return performance.now() - start;
  }).sort((a, b) => a - b);
  return durations[Math.floor(TIMING_RUNS / 2)];
}

function replicateNews(news: RankFeedInput['news'], count: number): RankFeedInput['news'] {
  return Array.from({ length: count }, (_, index) => {
    const source = news[index % news.length];
    return { ...source, id: `${source.id}#${index}` };
  });
}

export function logRankingTiming(input: RankFeedInput): void {
  const real = medianMs(() => rankFeed(input));
  const synthetic = medianMs(() =>
    rankFeed({ ...input, news: replicateNews(input.news, BENCHMARK_NEWS_COUNT) }),
  );
  console.log(
    `[ranking-timing] n=${input.news.length}: ${real.toFixed(1)} ms · n=${BENCHMARK_NEWS_COUNT} (réplicas): ` +
      `${synthetic.toFixed(1)} ms · mediana de ${TIMING_RUNS}`,
  );
}
```

Uso en `apps/mobile/app/(tabs)/feed.tsx`: guardar el argumento de `rankFeed` en una constante dentro del `useMemo` y
agregar `if (__DEV__) logRankingTiming(input);` antes del `return`. La línea aparece en la terminal de Metro. Las 200
noticias son réplicas de las reales con ids distintos (documentarlo así); el número de las ≈ 50 reales también se anota.
