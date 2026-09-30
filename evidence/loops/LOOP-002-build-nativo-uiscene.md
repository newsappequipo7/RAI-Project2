# LOOP-002 — Plan B en Xcode: el crash de UIScene y la firma de 7 días
2026-09-29 · Diego · Tareas: F1-04

## Comprensión
Se esperaba que `expo run:ios` con Apple ID gratuito instalara la app y que el único límite fuera la caducidad de la firma.

## Hipótesis
Con el bundle id propio y el equipo personal, el build nativo abre igual que en Expo Go.

## Construcción
Build nativo con Xcode 27 y `expo-build-properties`. Merge `8a7a818`.

## Prueba y observación
El primer arranque falló por la exigencia de UIScene de Xcode 27. Aparecieron además fallos de entorno: iPhone sin
detección por USB (otro cable/puerto), Modo Desarrollador apagado, perfil sin confiar, dispositivo bloqueado y
"No script URL" al lanzar a mano con `devicectl`. La firma gratuita caduca a los 7 días exactos.

## Corrección / decisión
Activar `enableSceneSupport` en `app.json`; dejar que `expo run:ios` lance la app; documentar la caducidad de 7 días en
ADR-001 (repetir el build para renovar).

## Rol de la IA en este loop
Claude Code identificó el error de UIScene a partir del log y propuso la propiedad de build. El diagnóstico de cable,
permisos y perfil dependió de lo que el usuario veía en el teléfono; sin ese reporte no había forma de saberlo.
