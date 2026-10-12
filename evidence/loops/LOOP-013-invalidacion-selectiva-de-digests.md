# LOOP-013 — Invalidar solo los digests que cambian, con el mismo código que los elige
2026-10-11 · Joaquín (con Claude Code) · Tarea: F4-03

## Comprensión
Cada ubicación tiene un digest: un resumen de sus 8 noticias mejor ubicadas, que se guarda en KV para que la segunda
consulta cueste 0 (CA1). F4-03 CA2 pide que publicar una noticia de GT invalide **solo** los digests de las ubicaciones
afectadas, y CHAT-RAG §5 lo describía como invalidar «los países/regiones afectados». El código heredado de F1-09
(`invalidateDigests` en `services/api/src/rag/index.ts`) borraba **todos** los digests en cualquier cambio del índice:
con esa base, CA2 era imposible y cada publicación obligaba a regenerar (y pagar) los 8 digests.

## Hipótesis
La de CHAT-RAG §5: una regla geográfica bastaría. Al publicar, se borrarían los digests de las ubicaciones cuyo país o
región coincide con el de la noticia, y se conservarían los demás.

## Construcción
No se llegó a implementar la regla geográfica. Al diseñar `refreshDigests` (`services/api/src/rag/digest.ts`) se razonó
que las noticias `global` y las esenciales pueden entrar en el digest de cualquier ubicación, así que «mismo país» no
equivale a «digest afectado». Se eligió recalcular la selección de cada digest guardado con `selectDigestNews`, que es
el mismo código que lo generó. Un digest se invalida si:
- cita una noticia que cambió o salió del índice, o
- su ubicación ahora elegiría otras noticias.

Si no, se re-sella con el nuevo `indexVersion`. `rebuild` invalida todos. Commit `e16296a` (PR #33).

## Prueba y observación
- `services/api/src/rag/digest.test.ts`, 13 pruebas en verde. Con digests de Madrid y Ciudad de Guatemala, publicar
  una noticia local de Guatemala devuelve `invalidatedDigests = ['gt-guatemala']`; la siguiente consulta de Madrid sale
  de caché con `costUsd = 0` (CA2). La segunda consulta de una ubicación con el mismo índice cuesta 0 (CA1).
- **Mutaciones** (aplicadas y revertidas en `refreshDigests`):
  - invalidar siempre, como antes, hace fallar 1 prueba (CA2);
  - no invalidar nunca hace fallar 4 (CA2, corrección o retiro de una noticia citada, `rebuild` y regeneración tras
    un cambio).
- Al escribir la prueba de CA2 se leyó `applyQuotas` (`packages/shared/src/ranking/antibubble.ts`): si entre las 10
  primeras no hay una noticia extranjera, la cuota **promueve una a la posición 8**. El corpus de la prueba necesitó una
  noticia `global` para Madrid; sin ella, la noticia de GT habría entrado al top 8 de Madrid. Es un segundo caso que la
  regla geográfica no habría visto.
- Al re-sellar, el primer código reescribía el digest con el TTL completo de 6 h, lo que alargaba la vida de un digest
  viejo en cada publicación. Se corrigió para conservar el tiempo que le quedaba (`DIGEST_TTL_SECONDS − edad`, mínimo
  60 s, que es lo que acepta KV).
- Pendiente: medir cuántas regeneraciones (y cuánto costo) se evitan en producción. Requiere el Worker en `live`.

## Corrección / decisión
- La invalidación no usa una regla geográfica aparte: la decide el mismo código que elige las noticias. Así, «ubicación
  afectada» significa exactamente «su digest cambiaría».
- Documentado en [CHAT-RAG §5](../../docs/domain/CHAT-RAG.md) («Implementación (F4-03)») y
  [MODELO-DATOS §6](../../docs/architecture/MODELO-DATOS.md). Sin ADR: no cambia el contrato público, solo cuándo se
  regenera un dato en caché.
- Límite aceptado: como la selección depende de la hora, un digest también puede invalidarse solo porque pasó tiempo.
  Es conservador: nunca deja uno incorrecto.

## Rol de la IA en este loop
Claude Code descartó la regla geográfica del documento al diseñar, por las noticias globales y esenciales, y propuso
invalidar recalculando la selección. El efecto de las cuotas lo encontró después, al construir la prueba. Joaquín
aceptó el enfoque. El error del TTL lo introdujo Claude Code al escribir el re-sellado y lo detectó al releer el código antes de correr las pruebas, no con una prueba. No hay una prueba que
falle si el TTL vuelve a alargarse; queda como riesgo menor.
