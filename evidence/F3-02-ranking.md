# F3-02 — Evidencia del motor de ranking

Fecha: 2026-10-09 · Rama: `fase-3/f3-02-ranking` · Responsable: Nelson

Estado: **implementada; CA2 pendiente en teléfono real**. No marcar Done todavía.

## Criterios de aceptación

| Criterio | Estado | Evidencia |
|---|---|---|
| CA1: nueve pruebas de RELEVANCIA §8 | Verificado | [`rankFeed.test.ts`](../packages/shared/src/ranking/rankFeed.test.ts), nueve casos con las cuatro personas y corpus fijo |
| CA2: 200 noticias en <20 ms en teléfono de gama media | Pendiente | Solo existe medición de escritorio abajo; falta modelo de teléfono, Expo Go, versión y tiempos |

## TDD y pruebas

Fecha fija de los fixtures: `2026-10-09T12:00:00.000Z`, usando `buildSeedNews`; sin Firestore ni reloj real.

1. Sin implementación: **9 fallaron, 131 pasaron**; typecheck pasó tras definir el contrato y el stub.
2. Primer motor: **140 pasaron** y typecheck pasó.
3. Casos adicionales: **2 fallaron, 180 pasaron**. Encontraron un problema real de separadores y cuotas;
   ver [LOOP-009](loops/LOOP-009-ranking-cuotas-y-diversidad.md).
4. Corrección y 100 variaciones reproducibles: **183 pasaron en 16 archivos** y typecheck pasó.

Pruebas adicionales en [`components.test.ts`](../packages/shared/src/ranking/components.test.ts) y
[`edgeCases.test.ts`](../packages/shared/src/ranking/edgeCases.test.ts): tabla de proximidad y precedencia,
afinidad, vida media, penalización de lectura, pesos/configuración inválida, ausencia de config/public,
esenciales independientes del perfil, ventana inclusiva de 72 h, más de cinco esenciales, exclusiones,
cuotas y diversidad en conjunto, corpus imposible de diversificar sin perder noticias, tiers y métricas,
esquema de salida para las ocho ubicaciones, ubicación explícita y orden independiente del orden de entrada.

Las nueve pruebas viven en shared para ejecutarse con su suite existente; no se añadió un workspace
`evals` ni dependencias para esta tarea. F4 puede reutilizar corpus y personas en sus evaluaciones.

## Validación del repositorio

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Lint y typecheck globales: verdes. Suite completa final: **432 pruebas correctas** (183 shared,
34 Firestore, 71 admin, 144 Worker). `git diff --check`: sin errores. Salida guardada en
[`F3-02-validation.txt`](F3-02-validation.txt). Revisión de imports de proveedores y URLs de modelos en
shared y clientes: sin coincidencias. Las pruebas de Firestore necesitan puertos locales; el sandbox los bloquea
con `listen EPERM`, por lo que se ejecutan con autorización fuera del sandbox. No se usan servicios de IA.

## Diagnóstico de rendimiento en escritorio (NO es CA2)

Reproducir con:

```bash
pnpm -F @repo/shared exec tsx scripts/benchmark-ranking.ts
```

Entorno medido: Linux x64, Node v24.21.0, Intel Core i7-8565U CPU @ 1.80GHz.
200 noticias, 100 iteraciones de calentamiento y 1000 muestras por escenario:

| Escenario | Mediana (ms) | p95 (ms) | Máximo (ms) |
|---|---:|---:|---:|
| Corpus fijo ampliado | 0.704 | 1.331 | 2.298 |
| Temas concentrados | 0.856 | 1.175 | 2.234 |

Salida original: [`F3-02-benchmark.json`](F3-02-benchmark.json).

El script imprime `phoneAcceptanceVerified: false`. Estos tiempos no predicen ni acreditan el rendimiento
en Hermes/Expo Go; el archivo solo sirve como diagnóstico reproducible de escritorio.

Para CA2, ejecutar dentro de Expo Go con 200 noticias válidas y IDs únicos, medir exclusivamente
`rankFeed(input)` mediante `performance.now()` (sin red, render ni logs dentro del intervalo), registrar
tiempo de primera llamada y muestras tras calentamiento. Guardar teléfono/modelo, SO, versión de Expo Go,
modo de ejecución, cantidad de noticias, mediana/p95/máximo y captura/video. Si alguna muestra excede el
objetivo, conservar el resultado y revisar antes de declarar CA2 cumplido.

## Contrato y límites

- `rankFeed` y `resolvePublicFeedConfig` se exportan desde `@repo/shared`; no leen Firestore ni llaman al Worker.
- F3-01 entrega noticias sin duplicados y filtradas por ventana, y suministra los pesos del listener de config.
- `reasons: []` hasta F3-03. No se implementó UI; no se afirma validación en iPhone/Android.
- Contratos actualizados: [relevancia](../docs/domain/RELEVANCIA.md), [datos](../docs/architecture/MODELO-DATOS.md),
  [referencia desde API](../docs/architecture/CONTRATOS-API.md), tipos y esquemas zod.
- Gasto de IA del proyecto durante esta implementación: USD 0. Sin llamadas al gateway desplegado ni proveedores reales; pruebas del Worker con mocks.
- Ninguna publicación/checklist editorial, seed, push, tag, merge o despliegue realizado por esta tarea.
