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
- Una noticia publicada lista para **retractar** en vivo (sección 7).

Secuencia:
1. Daniel publica D1. Nelson pide a compañeros en `gt-quetzaltenango`, `gt-guatemala` y `es-madrid` que miren el feed:
   aparece en "Lo que debes saber" para los dos de GT, con distinto tier; en Madrid no aparece en el bloque esencial.
2. Daniel publica D2 eligiendo portada tipográfica. Todos la ven con pie "Portada generada · no es foto".
3. Nelson proyecta `/compare` con ambas noticias y las 8 ubicaciones.
4. Joaquín pregunta en el chat desde `mx-cdmx`: "¿Qué se sabe de las lluvias en Guatemala?" → respuesta con chip
   "En desarrollo" heredado. Luego una pregunta fuera de corpus → abstención sin costo.
5. (Sección 7) Daniel retracta una noticia; Joaquín muestra que el chat deja de citarla.

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
| 6 | (sección 7) | Repetir la pregunta 2 tras la retractación | Ya no cita la noticia retractada (prueba: `services/api/src/rag/demoFlow.test.ts`) | — |

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
