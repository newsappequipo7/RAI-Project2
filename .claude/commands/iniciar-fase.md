---
description: Inicia una fase del proyecto (lee plan, fase y handoff anterior; verifica el entorno)
argument-hint: <número de fase, 1-4>
---

Vas a iniciar la FASE $ARGUMENTS del proyecto. Sigue este orden y no escribas código todavía:

1. Lee `CLAUDE.md` completo, `docs/PLAN.md` (§3, §5 y §6) y `docs/phases/FASE-$ARGUMENTS-*.md`.
2. Si la fase es mayor que 1, lee `docs/handoffs/FASE-(N-1).md` (N = $ARGUMENTS). Anota cualquier desviación o deuda que
   afecte a tu fase.
3. Verifica el entorno sin gastar créditos de IA:
   - `pnpm install --frozen-lockfile`
   - `pnpm lint && pnpm typecheck && pnpm test`
   - Confirma que el Worker esté en `AI_MODE=mock` (`GET /health` → `env`, y `wrangler.toml`).
   - Confirma que no existe `ANTHROPIC_API_KEY` en el entorno local ni en archivos (regla de oro 9).
4. Expande la fila de la fase en `docs/PLAN.md` §6 a una fila por tarea (☐).
5. Responde con: qué entiendes de la fase en 5 líneas, riesgos, desviaciones heredadas del handoff y el plan corto de la
   primera tarea. Espera confirmación antes de implementar.
