# LOOP-012 — Aislar la escritura de ubicación para probar el cambio en caliente

2026-10-09 · Nelson / Codex · F3-09

## Comprensión

F3-09 necesita mostrar la nueva ciudad y recalcular el feed sin esperar la confirmación de
Firestore. La prueba debía comprobar el orden con el corpus fijo y que el perfil persistido
conserva los intereses.

## Hipótesis

Se podía importar `updateProfileLocation` directamente desde el servicio de perfil móvil en
`firebase-tests` y pasarle la instancia del emulador.

## Construcción

Primero se añadió un parámetro opcional `db` a ese servicio y una prueba que iniciaba la
escritura, calculaba el ranking con el perfil optimista y luego esperaba la persistencia.

## Prueba y observación

`firebase-tests` falló en typecheck con `TS2305: Module '"@firebase/auth"' has no exported member
'getReactNativePersistence'`. Importar el servicio de perfil arrastraba el módulo de inicio de
Firebase para React Native al proyecto de pruebas Node. No era un fallo de Firestore ni del
ranking.

## Corrección / decisión

Se extrajo `saveProfileLocation(db, profile, locationId)` a
[`profileLocation.ts`](../../apps/mobile/src/services/profileLocation.ts), sin dependencias de
Expo ni React Native. El servicio móvil lo llama con su instancia de Firebase; la prueba lo
llama con el emulador. Después, `pnpm typecheck` y `pnpm test` pasaron: 532 pruebas, incluida
la nueva integración de F3-09. El criterio de 300 ms en pantalla sigue pendiente de medir en
Expo Go real.

## Rol de la IA en este loop

Codex propuso el parámetro opcional en el servicio móvil; el typecheck mostró que esa decisión
no aislaba la dependencia nativa. Codex cambió la implementación al módulo Firestore pequeño y
conservó la prueba de comportamiento. La corrección se aceptó por el typecheck y la suite verde.
