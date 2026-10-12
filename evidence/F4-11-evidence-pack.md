# F4-11 — Paquete de evidencia para la presentación

Fecha: 2026-10-11 · Responsable: Joaquín · Rama: `fase-4/f4-11-evidence-pack` · Gasto de IA: USD 0

| Paso | Estado | Resultado |
|---|---|---|
| 1. RAI-MATRIZ con enlaces | ☑ | [RAI-MATRIZ](../docs/responsible-ai/RAI-MATRIZ.md): cada fila enlaza pruebas, capturas o registros y tiene una columna de estado. Quedan ◐ las filas que esperan capturas en teléfono, la corrida en vivo del set dorado o la tabla de sugerencias de producción |
| 2. Tres mejores LOOPs para la sección 8 | ☑ | LOOP-006 (fuentes), LOOP-009 (diversidad) y LOOP-005 (calidad y costo de la IA), resumidos en [PRESENTACION-EVIDENCIA](../docs/ops/PRESENTACION-EVIDENCIA.md) §8; uno de F4-06 reemplazará a LOOP-005 cuando exista |
| 3. Tabla «IA sugirió vs editor publicó» | ◐ | `pnpm report:ai-suggestions --target=emulator\|prod [--out archivo.md]` (solo lectura). Verificado contra el emulador. Falta correrlo en producción, con tu gcloud, y que haya noticias publicadas con `aiSuggestions` guardadas |
| 4. Borrador de lecciones aprendidas | ◐ | [LECCIONES-APRENDIDAS](../docs/ops/LECCIONES-APRENDIDAS.md): supuestos que cambiaron, límites y qué haríamos distinto, cada uno con su evidencia. Lo atribuido a Diego, Daniel y Nelson está marcado «propuesta» hasta que lo confirmen |

## Criterio de aceptación

**CA1: cada afirmación de las diapositivas de las secciones 6–10 tiene un enlace a evidencia.** ◐ El documento
[PRESENTACION-EVIDENCIA](../docs/ops/PRESENTACION-EVIDENCIA.md) lista las afirmaciones por sección con su enlace y
estado. Todas las ☑ tienen evidencia. Las ☐ (latencias, reserva 3×, costo real del chat) dependen de F4-05 y F4-08 y no
deben afirmarse en las diapositivas hasta tenerla. Los enlaces se comprobaron con un script: 0 rotos.

## Tabla de sugerencias: prueba con el emulador

Con la semilla en un emulador efímero y `aiSuggestions` en dos noticias (el editor cambió la del sismo y conservó la
del dengue), el informe dio:

| Campo | Comparadas | El editor cambió | % cambiado |
|---|---|---|---|
| Temas | 2 | 1 | 50 % |
| Alcance geográfico | 2 | 0 | 0 % |
| Importancia | 2 | 1 | 50 % |
| Afirmaciones | 2 | 0 | 0 % |
| Resumen | 2 | 2 | 100 % |

Son datos de prueba, no del proyecto. Producción no se consultó. Lo esperable es que pocas de las 41 noticias
publicadas tengan sugerencias guardadas: la semilla se cargó sin pedirlas, y en LOOP-005 se canceló sin guardar. La tabla tendrá datos cuando se
publiquen los borradores editoriales usando el asistente de IA (F2-11).

Pruebas: `auditSuggestions` (2) en `packages/shared/src/editorial/suggestions.test.ts`; decodificación de Firestore y
Markdown (2) en `packages/shared/scripts/report-ai-suggestions.test.ts`.
