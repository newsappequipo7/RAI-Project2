# F3-03 — Evidencia de las explicaciones del feed

Fecha: 2026-10-09 · Responsable: Nelson · Rama: `fase-3/f3-03-explanations`
Base: `origin/main` actualizado, merge `9ba9785` del PR #18 (F3-02).

## Resultado y aceptación

`rankFeed` devuelve entre una y tres razones por noticia de `feed` y `mustKnow`. Los textos se generan
por código después de aplicar cuotas; se ordenan por contribución ponderada y conservan la explicación
de cualquier garantía editorial. No se cambian los puntajes, tiers, orden ni métricas para producir razones.

**CA1 verificado:** las cuatro personas del corpus tienen al menos una razón por ítem y ninguna contradice
sus componentes. Prueba parametrizada en
[`rankFeed.test.ts`](../packages/shared/src/ranking/rankFeed.test.ts), junto con las nueve propiedades
anteriores de F3-02. Comprueba esquema zod, máximo tres, orden, umbrales, marcas de garantía, contribuciones
según pesos efectivos y que la suma explicada no supere el score.

[`reasons.test.ts`](../packages/shared/src/explain/reasons.test.ts) verifica cada condición del catálogo,
límites inclusivos, omisión de condiciones no cumplidas, afinidad apagada/silenciada, tema secundario más
afín, etiquetas desconocidas, desempates, pesos cero, penalización de lectura, selección de tres razones
y reserva de un espacio para garantías. La integración prueba promociones reales de ambas cuotas y pesos
personalizados normalizados junto con ubicación explícita e historial de lectura.

## Desarrollo guiado por pruebas

- Stub vacío: 17 pruebas fallaron y 185 pasaron. Typecheck detectó además un fixture con importancia
  inferida como `number`; se corrigió el tipo del fixture a `RankedItem`.
- Catálogo original implementado: 4 fallaron y 198 pasaron; cada persona tenía alguna noticia sin razón.
  El problema y la decisión se registraron en [LOOP-010](loops/LOOP-010-catalogo-incompleto-de-razones.md).
- Explicación alternativa del aporte dominante y disponibilidad para score cero: 209 pruebas verdes.
- Casos de integración adicionales: **212 pruebas verdes en shared** (29 nuevas respecto de F3-02).

## Verificación final

Entorno: Node v24.21.0, pnpm 11.6.0, Linux x64.

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Suite completa: **461 pruebas correctas** (212 shared, 34 Firestore, 71 admin, 144 Worker).
Lint y typecheck globales: verdes; `git diff --check`: sin errores.
Salida reproducible de validación: [`F3-03-validation.txt`](F3-03-validation.txt).
Las pruebas del emulador usan puertos locales y se ejecutaron fuera del sandbox con autorización.
Revisión de código: sin imports de proveedores, URLs de modelos ni `fetch` en ranking/explicaciones.

No hay cambios de UI en esta tarea. El panel visible pertenece a F3-06; no se declara prueba en Expo Go.

## Rendimiento de escritorio con explicaciones incluidas

```bash
pnpm -F @repo/shared exec tsx scripts/benchmark-ranking.ts
```

Intel Core i7-8565U @ 1.80GHz, Linux x64, Node v24.21.0. 200 noticias, 100 llamadas de calentamiento y
1000 muestras por escenario. Salida: [`F3-03-benchmark.json`](F3-03-benchmark.json).

| Escenario | Mediana (ms) | p95 (ms) | Máximo (ms) |
|---|---:|---:|---:|
| Corpus fijo ampliado | 0.838 | 1.245 | 1.934 |
| Temas concentrados | 0.996 | 1.340 | 2.173 |

Es un diagnóstico local. **CA2 de F3-02 sigue pendiente en teléfono real**; el merge de F3-02 no cambia
ese estado y estas cifras no sustituyen la medición en Expo Go.

## Contrato para la siguiente tarea

- `Reason.contribution` es aporte al score después de pesos efectivos y penalización, no componente bruto.
- Garantías reservan un espacio y tienen contribución 0; el cero no implica que se deban ocultar en la UI.
- Si ningún umbral aplica, los códigos `importance_score`, `proximity_score`, `affinity_score` y
  `recency_score` explican el mayor aporte real. `available` se usa solo si todos los aportes son cero.
- Tipos y esquemas zod actualizados junto con [RELEVANCIA §6](../docs/domain/RELEVANCIA.md),
  [MODELO-DATOS](../docs/architecture/MODELO-DATOS.md), [CONTRATOS-API](../docs/architecture/CONTRATOS-API.md)
  y [handoff](../docs/handoffs/FASE-3.md). No hay migración de Firestore ni endpoints nuevos.
- Gasto de IA del proyecto en esta tarea: USD 0. Las pruebas del Worker usan mocks; no se llamó al gateway
  desplegado ni a proveedores reales. No se realizaron publicaciones editoriales.
