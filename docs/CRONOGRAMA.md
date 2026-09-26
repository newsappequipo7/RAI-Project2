# Cronograma (entrega: viernes 16 de octubre de 2026)

Equipo: **Diego Valenzuela** (coordinador, Fase 1), **Daniel Dubón** (Fase 2), **Nelson** (Fase 3),
**Joaquín** (Fase 4). La presentación probablemente es otro día; si se confirma, ajustar solo la sección 4.

## 1. Idea central

Las fases de código son **secuenciales** (una persona dueña de la rama principal a la vez), pero cada persona hace
**trabajo previo** mientras espera su turno. El trabajo previo solo toca archivos que nadie más está tocando
(paquete `shared` en carpetas propias, `evals/`, contenido, diseño), así que no genera conflictos ni dependencias.
Sin trabajo previo, 4 fases de 4 días no alcanzan.

## 2. Calendario

| Fecha | Diego | Daniel | Nelson | Joaquín |
|---|---|---|---|---|
| sáb 26 – dom 27 sep | **Día 0**: `docs/ops/SETUP-DIA-0.md` | Día 0 (su máquina + cuentas) | Día 0 | Día 0 |
| lun 28 sep | **F1** spikes: Expo Go + login (F1-01 a F1-03) | Previo: corpus semilla F1-10 (contenido) | Previo: diseño en Figma de tiers, lectura, "¿Por qué veo esto?" | Previo: leer CHAT-RAG, borrador del prompt v1 |
| mar 29 sep | F1: build nativo en Mac (F1-04), portal base, reglas (F1-05, F1-06) | Previo: corpus semilla (40 noticias) | Previo: diseño | Previo: set dorado (sobre IDs del corpus) |
| mié 30 sep | F1: Worker, gateway, ledger, índice (F1-07 a F1-09) | Previo: script `pnpm seed` junto con Diego | **Previo: motor de ranking F3-02 (TDD, solo `packages/shared/src/ranking/`)** | Previo: set dorado |
| jue 1 oct | F1: perfil/ubicación, CI, **handoff F1** | **F2 inicia**: lista y editor (F2-01, F2-02) | Previo: ranking + `explain/` (F3-03) | Previo: reglas de intención en `packages/shared/src/chat/intent.ts` con pruebas |
| vie 2 oct | Revisión de PRs, coordinación, soporte a Daniel | F2: fuentes, enrich (F2-03, F2-04) | Previo: `interests/update.ts` (F3-08, solo función pura) | Previo: intención + set dorado final |
| sáb 3 oct | Plantilla de presentación, página `/instalar` final | F2: reglas de certeza, publicar (F2-05, F2-06) | Previo: tokens de diseño | Previo: corpus editorial real con Daniel (F2-11) |
| dom 4 oct | Soporte | F2: imágenes, correcciones, costos (F2-07 a F2-09) | Previo: revisión de ranking con corpus real | Previo: corpus editorial real |
| lun 5 oct | Soporte | F2: pruebas, corpus real, **handoff F2** (F2-10 a F2-12) | **F3 inicia**: datos del feed, pantalla de feed (F3-01, F3-04) | Previo: prueba de la API del chat en modo mock |
| mar 6 oct | Revisión de PRs | Previo de lab Jev / apoyo | F3: imágenes, panel ¿Por qué?, lectura (F3-05 a F3-07) | Previo |
| mié 7 oct | Videos de respaldo de F1/F2 | Apoyo a F3 (pruebas en teléfonos) | F3: señales, ubicación, tiempo real (F3-08 a F3-10) | Previo |
| jue 8 oct | Soporte | Apoyo | F3: comparador, pulido, **handoff F3** (F3-11, F3-12) | Previo |
| vie 9 oct | Soporte | Apoyo | Apoyo a F4 | **F4 inicia**: pipeline sin generación (F4-01) |
| sáb 10 oct | Soporte | Apoyo | Apoyo | F4: generación, validación, digest (F4-02, F4-03) |
| dom 11 oct | `pnpm demo:prepare` (F4-09 parcial) | Apoyo | Apoyo | F4: UI del chat (F4-04) |
| lun 12 oct | Soporte | Apoyo | Apoyo | F4: evals base + 2 calibraciones (F4-05, F4-06) |
| mar 13 oct | Soporte | Apoyo | Latencia y costos reales (F4-08) | F4: inyección (F4-07), **handoff F4** |
| mié 14 oct | **Ensayo general 1** (todos) + correcciones | | | |
| jue 15 oct | Paquete de evidencia (F4-11), matriz RAI completa (todos) | | | |
| vie 16 oct | **Entrega**: congelar `main`, `git tag entrega`, snapshot de saldo | | | |
| Presentación −3 días | Ensayo 2; reinstalar build nativo en iPhones | | | |
| Presentación −1 día | Ensayo 3; `demo:prepare`; verificar saldo | | | |

## 3. Tareas reasignadas respecto a los documentos de fase

| Tarea | Documento original | Hace | Por qué |
|---|---|---|---|
| F1-10 corpus semilla | Fase 1 | Daniel (contenido) + Diego (script) | Descarga a Fase 1, que es la más pesada |
| F3-02, F3-03 ranking y explicaciones | Fase 3 | Nelson como trabajo previo | Son funciones puras en `shared`; no chocan con nadie |
| F3-08 (solo `update.ts`) | Fase 3 | Nelson como trabajo previo | Igual |
| Reglas de intención del chat | F4-01 | Joaquín como trabajo previo, en `packages/shared/src/chat/intent.ts` | Función pura; el Worker la importa en F4 |
| F4-05 (solo escribir el set dorado) | Fase 4 | Joaquín como trabajo previo | No necesita código |
| F4-08 latencia y costos | Fase 4 | Nelson | Fase 4 es la más pesada |
| F4-09 `demo:prepare` y videos | Fase 4 | Diego | Coordinación de la demo |
| F2-11 corpus real | Fase 2 | Daniel + Joaquín | Joaquín conoce el corpus que usará su set dorado |

## 4. Reglas del calendario

- Un handoff tarde corre a todos: si una fase se atrasa más de 1 día, Diego decide qué `[PLUS]` o tarea no crítica se
  recorta ese mismo día (y se registra como loop).
- Sincronización diaria de 10 minutos: qué terminé, qué hago hoy, qué me bloquea.
- Todo PR de otra persona lo revisa Diego o la persona de la fase siguiente (así la siguiente conoce el código antes
  de recibirlo).
- Nelson trabaja en Windows: puede hacer todo su trabajo con Expo Go en teléfonos reales; el build nativo de iOS lo
  hace siempre alguien con Mac.

## 5. Hitos verificables

| Fecha | Hito |
|---|---|
| mar 29 sep | Login con Google en 2 iPhone y 2 Android (sale de F1-03) |
| jue 1 oct | Worker con gateway y kill switch en producción; corpus semilla cargado |
| lun 5 oct | Publicar desde el portal y ver la noticia indexada |
| jue 8 oct | Feed distinto por ubicación + comparador |
| mar 13 oct | Chat con citas, abstención y evals calibradas |
| mié 14 oct | Ensayo general completo de las 10 secciones |
