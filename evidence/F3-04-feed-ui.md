# F3-04 — Pantalla de feed con jerarquía

Fecha: 2026-10-09 · Responsable: Nelson · Rama: `fase-3/f3-04-feed-ui`
Base: `origin/main` actualizado, squash `ef9228c` del PR #21 (F3-01).

## Resultado

La pestaña Noticias usa `useNewsFeed`, `useProfile` y el mismo `rankFeed` de `@repo/shared` que usará
el comparador. Presenta un encabezado con ubicación simulada y botón para cambiarla, el bloque
«Lo que debes saber» independiente del perfil con cinco titulares y «Ver todas», y cuatro tipos de
tarjetas según el tier calculado. Cada tarjeta muestra tema, alcance, hora relativa y certeza cuando no
es confirmada. Los visuales muestran el pie de `imageCaption` o la leyenda de `buildCoverSpec`; no se
añadieron módulos nativos. Hay estados de carga, vacío, error y reintento; deslizar actualiza la hora
del ranking y vuelve a suscribir la capa de datos.

| Criterio | Evidencia actual | Pendiente |
|---|---|---|
| CA1: cuatro personas ven feeds visiblemente distintos | Prueba de integración con corpus fijo: los cuatro top 5 difieren, con hero, grandes, medianas y compactas | Ver cuatro pantallas en Expo Go con perfiles/datos correspondientes |
| CA2: ninguna tarjeta carece de chips requeridos | Componentes comparten `NewsChips`; prueba del corpus comprueba tema, alcance y certeza según estado | Revisar todos los tiers y esenciales en teléfono |
| CA3: iPhone SE y Android grande | Layout flexible y typecheck; bundle de Expo | Ver ambos tamaños reales y registrar dispositivo/captura |

La vista de lectura sigue siendo el placeholder de F3-07; el panel «¿Por qué veo esto?» corresponde a
F3-06. F3-05 añadirá la hoja de procedencia y completará el tratamiento de imágenes. Esta tarea se marca
**◐** hasta la validación física requerida por la Definition of Done.

Para completar esa revisión: abrir la rama en Expo Go en un iPhone pequeño y un Android grande, iniciar
sesión y entrar a Noticias con datos publicados dentro de la ventana del feed. Comprobar la cabecera de
ubicación, el bloque esencial y «Ver todas», las cuatro densidades de tarjeta, pies y chips en noticias
confirmadas/en desarrollo/disputadas, modo oscuro y actualización al deslizar. Registrar modelos de
teléfono, resultado y capturas o video aquí. La disponibilidad de noticias recientes debe verificarse
antes de la prueba: la ventana normal es de 72 h por defecto y el corpus semilla caduca con el tiempo.

## Verificación

```bash
pnpm -F firebase-tests exec vitest run feedPresentation.test.ts
pnpm -F mobile typecheck
pnpm lint
pnpm typecheck
pnpm test
pnpm -F mobile exec expo export --platform web --output-dir /tmp/f3-04-web
pnpm -F mobile exec expo export --platform android --output-dir /tmp/f3-04-android
pnpm -F mobile exec expo export --platform ios --output-dir /tmp/f3-04-ios
git diff --check
```

La prueba de presentación contiene tres casos: distintos titulares para las cuatro personas, chips de
certeza/tema/alcance para el corpus y tiempo relativo en español con fecha local de Guatemala. Salida
de validación y empaquetado en [F3-04-validation.txt](F3-04-validation.txt).

**516 pruebas correctas** en la suite completa: 258 shared, 43 Firestore/presentación, 71 admin y
144 Worker. Lint y typecheck globales verdes; `git diff --check` sin errores. Expo exportó web, Android e iOS
con código empaquetado (incluida la ruta `/feed`). Son verificaciones de build, no capturas de pantalla
ni evidencia de Expo Go en un teléfono real.

No se usó el Worker ni se hicieron llamadas a modelos. Gasto de IA de esta tarea: USD 0. No se
publicaron noticias ni se marcaron checklists editoriales.
