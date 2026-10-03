# LOOP-006 — Una búsqueda web no basta: leer la fuente original antes de redactar
2026-10-02 · Daniel (con Claude Code) · Tareas: F2-11

## Comprensión
F2-11 pide al menos 15 noticias basadas en noticias reales recientes, reescritas por el equipo y con fuentes reales
enlazadas. Si el corpus tiene un dato falso o desactualizado, el chat lo repetiría con cita y etiqueta de «confirmada»:
es exactamente el riesgo que el proyecto dice controlar.

## Hipótesis
Con los resúmenes y enlaces que devuelve una búsqueda web por ubicación alcanza para redactar, y los enlaces son la
evidencia.

## Construcción
Una búsqueda por cada una de las 8 ubicaciones y unas 40 lecturas de la página original de cada fuente, pidiendo
cifras, fecha de publicación y quién afirma cada dato. Con lo leído se redactaron 16 borradores
(`packages/shared/fixtures/editorial-corpus.json`), un cargador que solo escribe borradores (`pnpm seed:editorial`) y la
guía de revisión `docs/ops/CORPUS-EDITORIAL.md`. Commit `3aec030`.

## Prueba y observación
La lectura de las fuentes originales contradijo a los resúmenes de búsqueda en cuatro casos:
1. **Aguinaldo en El Salvador:** el resumen decía «desde el 20 de octubre». La nota de Diario El Mundo era del
   **15 de octubre de 2025** (la reforma anterior); la vigente (Infobae y Diario El Salvador, 23–24 de septiembre de
   2026) paga desde el 1 de octubre, con 60 votos y 1 500 dólares exentos.
2. **Gasolina en Colombia:** Infobae anunciaba una subida de 46 pesos; El Tiempo (1 de octubre, 21:11) informaba de que
   el Gobierno la **revirtió** esa noche. Redactada como «sube» habría sido falsa a las pocas horas.
3. **Lluvias en CDMX:** una nota de El Universal que parecía del 1 de octubre era del **25 de mayo de 2026**.
4. **Cifras que no coinciden:** participantes del desfile de Xela (4 113 y 4 130) y tiendas en la Puerta del Sol
   (unas 500 el 30 de septiembre, 2 000 según los organizadores).

Además, cuatro páginas no se pudieron leer (La Hora, Cambio Colombia y Deia devolvieron 403/406; la Asamblea de El
Salvador, error de certificado) y el PDF del INDEC no lo extraía la herramienta de lectura; se leyó localmente con un
entorno virtual temporal para tener la fuente primaria. De 16 noticias, 8 salen `confirmada` (exigen 2 organizaciones
y una fuente primaria o agencia) y 8 `en_desarrollo` con su nota; ninguna quedó publicada.

## Corrección / decisión
- Regla de trabajo: ningún dato entra al corpus sin haber leído la fuente original, con su fecha comprobada; lo que no se
  pudo leer no se cita.
- El cargador solo escribe borradores y nunca pisa lo que una persona ya publicó o editó; el checklist queda sin marcar y
  una prueba automática (`corpus.test.ts`) asegura que ningún borrador se puede publicar sin esa decisión humana.
- Cada noticia lleva una nota «Qué revisar» para quien publica (p. ej. buscar la resolución oficial de la gasolina).

## Rol de la IA en este loop
Claude Code buscó, leyó y redactó, y descartó los resúmenes de búsqueda como fuente. Límite que se debe asumir: la
herramienta de lectura resume cada página con un modelo pequeño, así que una cifra extraída puede estar mal; por eso la
verificación final es humana (abrir cada enlace, checklist `fuentes_revisadas`). Se rechazó rellenar con noticias
inventadas o con fuentes sin leer para llegar a 15, y los borradores de demo del guion se marcaron como prueba con
fuentes de ejemplo, igual que la semilla.
