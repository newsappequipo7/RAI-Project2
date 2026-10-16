# Runbook de la demo final

El orden de la presentación es obligatorio. La demo funcional es el componente central.

## 1. Quién presenta qué

| # | Sección | Presenta | Qué se muestra (en vivo salvo indicación) | Evidencia de respaldo |
|---|---|---|---|---|
| 1 | Producto y alcance | Diego | Problema, usuarios (lector + editor), lo entregado vs checklist de PLAN.md §1 | Checklist marcada |
| 2 | App móvil | Nelson | Login Google en iPhone **y** Android, chat inicial, feed, lectura, cambio de ubicación | Video respaldo |
| 3 | Publicación en vivo | Daniel | Publicar 2 noticias: una local GT esencial y una internacional rutina; una sin imagen → portada/licencia libre | Video respaldo |
| 4 | Validación con compañeros | Nelson | Compañeros con ubicaciones distintas; comparador del portal proyectado mostrando posición y tier por ubicación | Capturas del comparador |
| 5 | Chat | Joaquín | Pregunta de mi región, de otro país, de tema, una fuera de corpus (abstención), una sobre noticia en desarrollo | Última corrida del set dorado |
| 6 | Arquitectura y decisiones | Diego | Diagrama, "IA al publicar / código al leer", ADRs clave, latencias | DECISIONES.md |
| 7 | Transparencia y Responsible AI | Daniel (fuentes, validación, imágenes) + Nelson (importancia, burbuja) | Matriz RAI; "¿Por qué veo esto?"; "Cómo se hizo esta noticia"; retractación en vivo | RAI-MATRIZ.md, pruebas de ranking |
| 8 | Engineering loops y gestión | Joaquín | 3 loops reales con antes/después, requisitos, criterios, DoD, tablero | evidence/loops |
| 9 | Costos | Diego | Dashboard `/costs` en vivo, costo por función, medidas de ahorro, reserva restante | Snapshots de saldo |
| 10 | Lecciones aprendidas | Joaquín (con aportes de todos) | Supuestos que cambiaron, límites, qué haríamos distinto | Loops |

## 2. Guion de la sección 3–5 (la parte más riesgosa)

### Día antes de la presentación

1. `EVAL_ID_TOKEN=… pnpm demo:prepare --api https://news-api.diegovalenzuela.workers.dev`. Debe terminar con «Todo listo
   para el ensayo».
2. Calcular cuántas horas hay entre la última publicación del corpus y la hora de la presentación. Si son **más de 72 h**,
   ajustar `config/public.feedWindowHours` (documento de Firestore, solo admins) a ese valor más un margen, y anotarlo en
   [F4-09](../../evidence/F4-09-demo-readiness.md). La ventana de «Lo que debes saber» y el digest siguen en 72 h
   (ADR-013), así que el feed y el digest pueden diferir.
3. Volver a abrir el feed de `gt-guatemala`, `mx-cdmx` y `es-madrid` para comprobar que se ven noticias.

Preparación (30 min antes):
- Corpus semilla cargado y **índice reconstruido desde el portal** (`/news` → «Reconstruir índice», que indexa todo lo
  publicado). No reconstruir con `pnpm seed` con `SEED_ID_TOKEN` ni con «Indexar corpus semilla» de `/indice`: esas dos
  reemplazan el índice solo con las 40 noticias semilla y dejan fuera las editoriales publicadas.
- `EVAL_ID_TOKEN=… pnpm demo:prepare --api https://news-api.diegovalenzuela.workers.dev`: revisa `aiMode`, kill switch,
  saldo y calienta los digests de las 8 ubicaciones. Debe terminar con «Todo listo para el ensayo».
- Flags: `chatMode=full`, `imageGenEnabled=false` (la portada tipográfica es suficiente y cuesta 0). `env=demo` no es un
  flag: es la variable `ENV` de `services/api/wrangler.toml` y se cambia con un despliegue (`AI_MODE=live` también).
- Noticia maliciosa de F4-07 **fuera** del índice (`pnpm seed:injection --api <worker> --remove`).
- Dos noticias preparadas como **borrador** con fuentes ya cargadas (para no teclear en vivo):
  - D1: "Alerta por lluvias intensas en Quetzaltenango", local, esencial, `en_desarrollo`, con nota.
  - D2: "Banco central europeo mantiene tasas", internacional, rutina, `confirmada`, sin imagen.
- Noticia lista para **retractar** en vivo (sección 7): `n-ar-003` «Científicos argentinos describen una nueva especie de
  dinosaurio patagónico» (publicada, `confirmada`). Elegida porque no aparece en el set dorado ni en las preguntas de este
  runbook, así que no está en caché de evals. Antes de la demo comprobar que sigue publicada e indexada y que la pregunta
  de retractación la devuelve primera (búsqueda sin LLM, `POST /admin/index/search`; 2026-10-15: `n-ar-003` con 0.647 y
  la segunda con 0.271).

Secuencia:
1. Daniel publica D1. Nelson pide a compañeros en `gt-quetzaltenango`, `gt-guatemala` y `es-madrid` que miren el feed:
   aparece en "Lo que debes saber" para los dos de GT, con distinto tier; en Madrid no aparece en el bloque esencial.
2. Daniel publica D2 eligiendo portada tipográfica. Todos la ven con pie "Portada generada · no es foto".
3. Nelson proyecta `/compare` con ambas noticias y las 8 ubicaciones.
4. Joaquín pregunta en el chat desde `mx-cdmx`: "¿Qué se sabe de las lluvias en Guatemala?" → respuesta con chip
   "En desarrollo" heredado. Luego una pregunta fuera de corpus → abstención sin costo.
5. (Sección 7) Joaquín pregunta «¿Qué se sabe del dinosaurio que describieron científicos argentinos?» y muestra la cita a
   `n-ar-003`. Daniel la retracta desde el portal (con corrección) y Joaquín repite la pregunta: el chat ya no la cita.

### Sección 5 (Chat) paso a paso — Joaquín

Se muestra desde un teléfono proyectado; cada respuesta se abre en «¿Cómo se generó?» para enseñar la intención, las
noticias usadas y el costo. Las preguntas salen del set dorado (última corrida como respaldo).

| # | Ubicación | Pregunta | Qué debe verse | Caso del set |
|---|---|---|---|---|
| 1 | `gt-guatemala` | «Resume lo más importante de hoy» | Modo digest; «Resumen generado con IA…»; en «¿Cómo se generó?», caché del digest y costo 0 | q01 |
| 2 | `mx-cdmx` | «¿Qué se sabe de las lluvias en Guatemala?» (tras publicar D1) | Bloque con chip «En desarrollo», aviso de información en desarrollo y fuente D1 tocable | guion §2.4 |
| 3 | `gt-guatemala` | «Explícame lo más importante de México» | Intención «Noticias de otro país»; cita el huracán | q09 |
| 4 | `us-nueva-york` | «¿Qué se acordó en la cumbre climática?» | Tema; fuente tocable que abre la lectura | q16 |
| 5 | `es-madrid` | «¿Quién ganó el mundial de ajedrez de 1972?» | Abstención; pie «Sin IA: …» y costo 0 en el panel | q23 |
| 6 | `gt-guatemala` (sección 7) | «¿Qué se sabe del dinosaurio que describieron científicos argentinos?», antes y después de retractar `n-ar-003` | Antes cita `n-ar-003`; después ya no la cita (prueba: `services/api/src/rag/demoFlow.test.ts`) | fuera del set |

Si el proveedor falla o el saldo baja: `chatMode = retrieval_only` desde `/costs`; el chat muestra las entradillas
con el pie «Sin IA: resultado de búsqueda» y se explica como degradación controlada.

## 3. Planes de contingencia

| Falla | Respuesta |
|---|---|
| Wifi del aula no deja entrar a compañeros | Hotspot propio; si falla, usar los 4 teléfonos del equipo con ubicaciones distintas |
| Expo Go no carga | iPhones con Plan B (build nativo) + Android APK |
| Proveedor LLM caído o lento | `chatMode = retrieval_only` (muestra noticias encontradas sin generación) y explicarlo como degradación elegante |
| Saldo inesperadamente bajo | Mismo `retrieval_only`; mostrar dashboard como prueba de control |
| Todo falla | Videos de respaldo por sección en `evidence/demo-videos/` |

## 4. Ensayos

- Ensayo general 1: 7 días antes. Ensayo 2: 3 días antes (reinstalar Plan B después de este). Ensayo 3: día anterior.
- Cronometrar cada sección. Registrar gasto de cada ensayo en el ledger (`env=demo`) y ajustar la reserva.
- Registro de los ensayos: [`evidence/F4-10-rehearsals.md`](../../evidence/F4-10-rehearsals.md).

## 5. Limitaciones declaradas (sección 10, Lecciones aprendidas)

Se dicen en voz alta; no se esconden.

- **La noticia no guarda la fecha del hecho.** `News` solo tiene `publishedAt`, que es cuándo se publicó. Una noticia
  sobre un hecho de hace semanas, publicada hoy, el feed la trata como reciente. Lo vimos el 2026-10-15 al revisar las
  editoriales: `ed-gt-004` (desfile del 15 de septiembre) y `ed-co-002` (marchas del 1 al 4 de octubre) se retuvieron
  en borrador por esto. Propuesta para trabajo futuro, sin implementar: un campo opcional `eventDate` que alimente la
  recencia y se muestre en la lectura. Evidencia: [LOOP-017](../../evidence/loops/LOOP-017-falta-de-fecha-del-hecho.md).

## 6. Pendientes para la presentación (estado al 2026-10-16)

Diego cerró la entrega con el estado actual. Esto queda por hacer antes de presentar; nada de lo de abajo está hecho.

**Guiones por escribir** (qué se dice, qué se muestra y qué evidencia se abre). Hoy el runbook solo tiene guion paso a paso
para las secciones 3 a 5 (§2):
- [ ] Sección 1, Producto y alcance (Diego).
- [ ] Sección 2, App móvil en iPhone y Android (Nelson).
- [ ] Sección 6, Arquitectura y decisiones (Diego): ADR-012 a ADR-014 incluidos.
- [ ] Sección 7, Transparencia y Responsible AI: la retractación en vivo ya está en §2 (`n-ar-003`); falta el guion de la
  matriz RAI.
- [ ] Sección 8, Engineering loops y gestión (Joaquín): usar LOOP-016, LOOP-015 y LOOP-005, con LOOP-002 de reserva.
  Dejar dicho que algunos loops se hicieron con otro agente (Codex), no con Claude Code. Se presenta tal cual.
- [ ] Sección 9, Costos (Diego): `/costs` en vivo, [PRESUPUESTO-IA](PRESUPUESTO-IA.md) y el snapshot de saldo.
- [ ] Sección 10, Lecciones aprendidas (Joaquín): incluir las limitaciones declaradas de §5 y los loops 017 y 018.

**Operativo:**
- [ ] Tres ensayos generales ([registro](../../evidence/F4-10-rehearsals.md)); reinstalar el Plan B en los iPhone después del
  segundo (la firma gratuita vence a los 7 días exactos).
- [ ] Videos de respaldo, uno por sección, en `evidence/demo-videos/` (nombres en
  [CAPTURAS-PENDIENTES](../../evidence/CAPTURAS-PENDIENTES.md) §14).
- [ ] Probar el chat en un Android y guardar las capturas (F4-04 CA1).
- [ ] Día antes: `pnpm demo:prepare` y, si hace falta, ajustar `config/public.feedWindowHours` (§2 y ADR-013).
- [ ] Desplegar el Worker con `ENV=demo`: `pnpm -F api run deploy --var AI_MODE:live --var ENV:demo` y comprobar en
  `/health` que `aiMode` es `live` y `env` es `demo` (sin `--var AI_MODE:live`, el Worker vuelve a `mock`).
- [ ] Medir F3-02 CA2 y F3-09 con el log `__DEV__` y el método de 240 fps ([CAPTURAS-PENDIENTES](../../evidence/CAPTURAS-PENDIENTES.md) §8 y §13).
- [ ] Confirmar la fecha de la presentación y que la key de Anthropic (vence el 2026-10-29) siga vigente ese día.
