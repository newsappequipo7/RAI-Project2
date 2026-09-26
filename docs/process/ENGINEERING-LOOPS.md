# Engineering loops, requisitos y Definition of Done

El enunciado pide que el desarrollo asistido por IA sea **observable**: ciclos de comprensión → hipótesis →
construcción → prueba → observación → corrección, con ejemplos reales de cómo la evidencia cambió una decisión.

## 1. Formato de requisito y criterio de aceptación

Cada tarea de fase tiene: ID, objetivo, documentos a leer, pasos, **criterios de aceptación** verificables y evidencia
esperada. Los criterios usan Given/When/Then cuando describen comportamiento:

```
CA-F3-04-2: Dado un usuario en gt-quetzaltenango con política silenciada,
cuando se publica una noticia esencial de política local de Quetzaltenango,
entonces aparece en "Lo que debes saber" en menos de 5 segundos sin recargar.
```

## 2. Definition of Done (aplica a toda tarea)

Una tarea está Done cuando:
1. Todos sus criterios de aceptación se verificaron y cada uno tiene evidencia (test, captura, video o salida de consola).
2. `pnpm lint && pnpm typecheck` pasan; las pruebas del paquete tocado pasan.
3. No hay llamadas a modelos fuera del gateway (revisar con `grep` de SDKs de proveedores fuera de `services/api/src/ai`).
4. Si tocó UI: probado en Expo Go en al menos un iPhone o un Android real (indicar cuál en la evidencia).
5. Si cambió un contrato: docs, tipos y esquemas actualizados en el mismo PR.
6. Fila actualizada en `docs/PLAN.md` §6 con enlace a la evidencia.
7. Si una observación cambió el plan, hay un loop registrado.

## 3. Registro de loops (`evidence/loops/LOOP-XXX.md`)

Crear con el comando `/registrar-loop`. Plantilla:

```markdown
# LOOP-XXX — Título corto
Fecha · Persona · Tarea(s): F?-??

## Comprensión
Qué entendíamos del problema.

## Hipótesis
Qué creíamos que funcionaría y por qué.

## Construcción
Qué hicimos (commit/PR).

## Prueba y observación
Qué medimos o vimos. Datos concretos (números, capturas, salida de evals, costo).

## Corrección / decisión
Qué cambiamos a partir de la evidencia. Enlace a ADR si aplica.

## Rol de la IA en este loop
Qué propuso Claude Code, qué aceptamos, qué rechazamos y por qué.
```

Meta: al menos 3 loops por fase; al menos 3 de todo el proyecto con impacto claro para la sección 8.
Loops que casi seguro van a ocurrir (buenos candidatos): calibración del umbral de abstención; ajuste de pesos del
ranking tras ver el comparador; login en iOS (primer intento fallido → corrección); costo real vs estimado de `enrich`.

## 4. Tablero

GitHub Projects con columnas `Backlog → En curso → Revisión → Done`. Una tarjeta por tarea de fase, con el ID.
Mover a Done solo con el checklist de DoD del PR completo.

## 5. Uso de Claude Code (reglas de trabajo con IA)

- Iniciar cada sesión con `/iniciar-fase N` o pidiendo leer `CLAUDE.md` y el archivo de fase.
- Pedir plan antes de cambios de más de ~3 archivos.
- No aceptar código que el agente no pudo ejecutar o probar; pedir la prueba.
- Guardar en el loop las veces que el agente se equivocó y cómo se detectó: es evidencia valiosa, no algo que ocultar.
