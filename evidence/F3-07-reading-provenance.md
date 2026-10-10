# F3-07 — Lectura con procedencia

Fecha de revisión documental: 2026-10-10 · Responsable: Nelson · Integrada en `main` por el PR #25 (`a155787`)

La ruta [`news/[id].tsx`](../apps/mobile/app/news/[id].tsx) observa directamente el documento publicado y sus versiones; [`NewsDetailContent.tsx`](../apps/mobile/src/news/NewsDetailContent.tsx) presenta el cuerpo, imagen y pie, certeza, fuentes, justificación editorial, afirmaciones, correcciones e historial. Las noticias retractadas siguen accesibles mediante su enlace directo con banner rojo y texto tachado, aunque el feed las excluya. El resumen IA aprobado se etiqueta «Resumen generado con IA · revisado por {editor}». La vista disputada separa fuentes que confirman y contradicen.

| Criterio | Evidencia disponible | Pendiente |
|---|---|---|
| CA1: cuatro certezas visibles correctamente | Implementación integrada y reporte manual general de Nelson del 2026-10-10 | Registrar las cuatro pantallas en Expo Go, con teléfono y sistema identificados. |
| CA2: cada elemento generado con IA lleva etiqueta | Etiquetas de resumen e imagen en componentes; reglas de procedencia compartidas | Comprobar en teléfono los ejemplos de IA que efectivamente existan y conservar captura. |

La lectura no llama al Worker ni a un LLM. La revisión documental no equivale a una prueba visual de las cuatro certezas. Ver [registro general de prueba](F3-12-manual-review.md). Por ello F3-07 queda en **◐**, corrigiendo la fila ☐ obsoleta de `PLAN.md`.
