# LOOP-011 — Un reloj independiente para el decaimiento

Fecha: 2026-10-09 · Persona: Nelson (implementación asistida por Codex) · Tarea: F3-08, paso 1

## Comprensión

Los intereses deben subir o bajar según señales deterministas, respetar [0,10] y perder 10 % cada día.
RELEVANCIA §7 proponía aplicar el decaimiento al abrir la app si había pasado un día desde `updatedAt`.

## Hipótesis

Usar `updatedAt` como referencia para el decaimiento sería suficiente, sin ampliar el perfil persistido.

## Construcción

Se revisó `apps/mobile/src/services/profile.ts`: cambiar la ubicación escribe `updatedAt`. La función
de intereses también necesita actualizarlo cuando procesa una señal. Se añadió una prueba de regresión:
interés en salud de 10, lectura a las 12 h, cambio de ubicación a las 20 h y apertura a las 24 h.

## Prueba y observación

Con un reloj independiente la prueba obtiene 9, como corresponde. Para comprobar que detecta la
regresión, se sustituyó temporalmente la referencia por `Date.parse(profile.updatedAt)` y se ejecutó:

```bash
pnpm -F @repo/shared exec vitest run src/interests/update.test.ts -t 'does not postpone decay'
```

**Una prueba falló, 41 omitidas: esperaba 9 y recibió 10.** La lectura y el cambio de ubicación posponían
el decaimiento. Se restauró inmediatamente la implementación correcta. Salida real en
[`F3-08-clock-mutation.txt`](../F3-08-clock-mutation.txt). La suite completa posterior pasó:
258 pruebas de shared, 507 en el repositorio, lint y typecheck verdes.

## Corrección / decisión

Añadir `UserProfile.interestsDecayedAt` opcional, inicializado en perfiles nuevos. Los documentos antiguos
usan `updatedAt` una vez; luego el decaimiento avanza exclusivamente por intervalos completos de 24 h,
conservando el tiempo restante. Se aplica `0.9 ** díasCompletos` antes del delta recibido. Cambiar ubicación
o registrar lecturas no reinicia este reloj. Tipos, esquemas y documentos se actualizan juntos.

Se validan fechas y orden temporal; no se modifica la entrada. La migración por uso y la conservación
de fracciones del día tienen pruebas propias. Persistencia y controles de la app quedan pendientes.
Evidencia de aceptación: [F3-08-interests.md](../F3-08-interests.md).

## Rol de la IA en este loop

Codex detectó la interferencia al leer el servicio existente, propuso el campo opcional y comprobó la
regresión mediante una mutación deliberada. La decisión inicial del documento de usar solo `updatedAt`
se descartó por ese resultado. Nelson autorizó continuar con la siguiente tarea; esta ampliación del
contrato queda para revisión en la rama. No se atribuye una aprobación específica que aún no ocurrió.
No se invocaron proveedores de IA del proyecto ni se hicieron publicaciones editoriales.
