# LOOP-008 — Ramas creadas sobre un `main` local desactualizado
2026-10-02 · Daniel (con Claude Code) · Tareas: F2-06, F2-07 (proceso)

## Comprensión
El flujo es una rama por tarea y un PR a `main`, con el usuario haciendo cada push. Entre tareas, `main` avanza en el
remoto cuando se mergean los PR.

## Hipótesis
Crear la rama siguiente desde `main` basta para partir del trabajo ya integrado.

## Construcción
La rama de F2-06 se creó desde el `main` **local**, que no tenía aún el merge de F2-05 (commit `e56b2c4` es el primero de
esa rama).

## Prueba y observación
Dos problemas distintos del mismo origen:
1. **Base vieja:** al correr las pruebas de `shared` aparecieron 49 en lugar de las 76 esperadas; faltaba todo
   `validatePublish`. Se detectó por el conteo, antes de hacer commits: se adelantó la rama a `origin/main` y se resolvió
   un conflicto trivial de exports.
2. **Push rechazado:** las ramas de F2-06 y F2-07 se crearon con `origin/main` como punto de partida y Git les dejó
   `origin/main` como *upstream*; `git push` falló con «The upstream branch of your current branch does not match the
   name of your current branch» y la sugerencia `git push origin HEAD:main`, que habría publicado directo en `main`.

La fase 1 ya había visto una variante: Hosting se desplegó una vez desde un `main` local desactualizado y dejó producción
sin el trabajo de F2-09 hasta redesplegar desde `origin/main` (LOOP-005).

## Corrección / decisión
- Antes de empezar cada tarea: `git fetch` y crear la rama con `git checkout -b fase-2/<tarea> --no-track origin/main`.
- Comprobar que el código de la tarea anterior está presente (conteo de pruebas o un archivo conocido) antes de escribir.
- Se aclaró al usuario que `git push -u origin HEAD` publica la rama con su nombre y que **no** debe usarse
  `HEAD:main`.
- Desde F2-08 todas las ramas se crean sin *upstream* y el push funciona a la primera.

## Rol de la IA en este loop
El error fue de Claude Code (partió de un `main` local sin traer el remoto) y lo detectó un indicador objetivo, el
número de pruebas, no una revisión. Aceptado: `--no-track` y el chequeo de presencia. La alternativa de dejar la rama
vieja y resolver los conflictos al hacer el PR se rechazó porque habría mezclado dos tareas en un solo diff.
