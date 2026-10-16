# LOOP-017 — La noticia no sabe cuándo ocurrió el hecho, solo cuándo se publicó
2026-10-15 · Diego (con Claude Code) · Tareas: F2-11 (corpus editorial real), F3-02 (ranking por recencia)

## Comprensión
El modelo `News` guarda `publishedAt` y ningún campo con la fecha del hecho. Al publicar un borrador,
`buildPublication` fija `publishedAt = news.publishedAt ?? ahora`, y los borradores del corpus editorial no traen
`publishedAt`, así que quedan con la hora de la publicación. El ranking usa ese campo como única señal de recencia
(`packages/shared/src/ranking/score.ts`, `rankFeed.ts` y `antibubble.ts`). Esto lo vimos al revisar una por una las 14
editoriales pendientes de prod el 2026-10-15, antes de publicarlas.

## Hipótesis
Publicar hoy noticias cuyos hechos son de semanas atrás hace que el feed las trate como recientes y que el lector no
pueda distinguir una noticia nueva de una vieja republicada. Un campo opcional `eventDate` (fecha del hecho) permitiría
calcular la recencia con ella y mostrarla en la lectura. No lo implementamos hoy: cambiar un contrato obliga a tocar
tipos, esquema zod, `MODELO-DATOS.md` y el ranking, y falta un día para la entrega.

## Construcción
No se cambió código ni contrato. Lo construido fue la revisión automática de las 14 editoriales (script de solo lectura
contra Firestore de prod, fuera del repo): comprobó que cada URL respondiera, que el nombre de la fuente coincidiera con
el dominio, la independencia de organizaciones y `validatePublish`. Lo de la vigencia salió de leer las fuentes y los
títulos, no de ese script.

## Prueba y observación
- Las fuentes de las 14 son del 2026-09-23 al 2026-10-03; los hechos van del 15 de septiembre (desfile de `ed-gt-004`,
  Soy502 lo titula «Desfile del 15 de septiembre») al 4 de octubre. Publicadas el 15 de octubre, todas quedarían con
  `publishedAt` de ese día.
- Casos extremos: `ed-gt-004` (desfile del 15 de septiembre, un mes antes) y `ed-co-002` (marchas «del 1 al 4 de octubre»,
  anunciadas en futuro y ya pasadas).
- `ed-us-001` y el duplicado que se publicó antes ya muestran el efecto de otra forma: la copia publicada el 14 de
  octubre tiene un `publishedAt` cinco días más reciente que la original (ver LOOP-018).
- Pendiente: no se midió cuánto cambia el orden del feed por este efecto (habría que comparar `rankFeed` con la fecha del
  hecho en lugar de `publishedAt`). No hay cifra y no la inventamos.

## Corrección / decisión
- `ed-gt-004` y `ed-co-002` se quedan en borrador por vigencia del hecho (decisión de Diego, 2026-10-15). No hay ADR
  porque no se cambió ninguna decisión de arquitectura.
- Las demás editoriales las decide Diego tras abrir y revisar sus fuentes (pendiente al escribir este loop).
- Trabajo futuro, sin hacerlo hoy: campo opcional `eventDate` en `News`, `newsSchema` y `MODELO-DATOS.md`; usarlo en
  la recencia de `score.ts` y mostrarlo en la lectura («Hecho del …»); validarlo en el portal para noticias de más de
  unos días.
- Mientras tanto queda como **limitación declarada** en el guion de la sección 10 del DEMO-RUNBOOK.

## Rol de la IA en este loop
- Claude Code detectó el problema al leer las fuentes durante la revisión y propuso el campo `eventDate`; Diego decidió
  retener las dos noticias más afectadas y no cambiar el contrato.
- Errores de Claude Code en esta revisión, detectados al leer su propia salida: (1) el script contó las afirmaciones
  «no confirmadas» comparando contra el valor `confirmada`, cuando el tipo `Claim` usa `respaldada`, y salió un conteo
  igual al total de afirmaciones; se vio que no tenía sentido, se revisó el tipo y se corrigió antes de entregar la
  tabla; (2) marcó como caída la URL del INDEC (HTTP 406) por usar un cliente sin cabeceras de navegador; con un User-Agent
  de navegador responde 200.
- No se usó ninguna llamada a un LLM del proyecto ni se gastaron créditos.
