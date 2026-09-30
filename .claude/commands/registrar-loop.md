---
description: Registra un engineering loop en evidence/loops/ con la plantilla del proyecto
argument-hint: <título corto> [tareas, p. ej. F1-08]
---

Registra un loop nuevo: $ARGUMENTS

1. Lee `docs/process/ENGINEERING-LOOPS.md` §3 (plantilla) y lista `evidence/loops/` para calcular el siguiente número
   `LOOP-XXX` (tres dígitos, consecutivo).
2. Reconstruye el loop con hechos de la conversación, los commits y la evidencia real. No inventes números ni resultados:
   si falta un dato, escribe "pendiente" y dilo.
3. Escribe `evidence/loops/LOOP-XXX-slug.md` con las secciones: Comprensión, Hipótesis, Construcción, Prueba y
   observación (datos concretos), Corrección / decisión (con enlace a ADR si aplica) y Rol de la IA (qué propuso Claude
   Code, qué se aceptó, qué se rechazó y las veces que se equivocó y cómo se detectó).
4. Agrega el loop a la sección 8 del handoff de la fase actual.
5. Nunca incluyas secretos ni tokens en el archivo (el repo es público).
