---
description: Cierra una fase (verifica el DoD de todas sus tareas y lista pendientes)
argument-hint: <número de fase, 1-4>
---

Vas a cerrar la FASE $ARGUMENTS. No etiquetes ni empujes nada sin confirmación explícita.

1. Lee `docs/phases/FASE-$ARGUMENTS-*.md`, `docs/PLAN.md` §6 y `docs/process/ENGINEERING-LOOPS.md` §2 (Definition of Done).
2. Para cada tarea de la fase, verifica uno por uno sus criterios de aceptación y que exista evidencia (test, captura,
   video, salida de consola o PR). Marca en una tabla: ☑ hecha, ◐ falta evidencia, ☐ pendiente.
3. Corre `pnpm lint && pnpm typecheck && pnpm test` y reporta el resultado real.
4. Revisa que no haya llamadas a proveedores de IA fuera de `services/api/src/ai` (existe una prueba de frontera; córrela).
5. Revisa que los contratos cambiados estén reflejados en `docs/architecture/`, `packages/shared` y el handoff.
6. Cuenta los loops de la fase en `evidence/loops/` (meta: al menos 3).
7. Completa `docs/handoffs/FASE-$ARGUMENTS.md` con `docs/process/HANDOFF-TEMPLATE.md`: incluye gasto de IA real
   (`GET /admin/costs`) y la deuda conocida sin maquillarla.
8. Entrega un resumen con lo pendiente. Solo con confirmación: `git tag fase-$ARGUMENTS-done`.
