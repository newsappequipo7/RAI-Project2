# F3-08 — Evidencia de la función pura de intereses

Fecha: 2026-10-09 · Responsable: Nelson · Rama: `fase-3/f3-08-interests`
Base: `origin/main` actualizado, squash `0f5b84c` del PR #19 (F3-03).

## Alcance y aceptación

Implementado el **paso 1**: `updateInterests({ profile, signal?, now }): UserProfile` en `@repo/shared`.
Aplica deltas por tema distinto, límites [0,10], silencios, reactivación, reinicio y decaimiento diario.
Valida con zod, no muta entradas ni accede a reloj global, red, Firestore o modelos.

| Criterio de F3-08 | Estado | Evidencia |
|---|---|---|
| CA1: pruebas de `update.ts` pasan | Verificado | 42 casos en [`update.test.ts`](../packages/shared/src/interests/update.test.ts) |
| CA2: leer tres noticias deportivas cambia visiblemente el feed | Pendiente en la app | Una prueba pura confirma mayor posición y score para una noticia deportiva aún no leída tras tres sesiones; falta captura de señales y demostración en teléfono |
| CA3: toggle apagado produce el mismo orden entre cuentas de la misma ubicación | Pendiente en la app | Integración pura produce el mismo resultado pese a intereses e historial diferentes; faltan toggle, persistencia y recorrido entre cuentas |

Las cuatro pruebas de [`ranking.test.ts`](../packages/shared/src/interests/ranking.test.ts) cubren
aprendizaje tras tres lecturas, «Menos de esto»/reactivación sin ocultar esenciales, modo sin personalizar
y reinicio. F3-08 permanece **◐**: los pasos 2–4 requieren feed, lectura y controles posteriores.

## Desarrollo guiado por pruebas

- Stub que devolvía el perfil: 18 pruebas fallidas, 216 correctas; typecheck verde.
- Implementación inicial: 234 pruebas de shared correctas; typecheck verde.
- Validación, casos de borde e integración con ranking: **258 pruebas correctas en shared**,
  46 nuevas respecto de F3-03 (42 de actualización y 4 de integración).
- Mutación deliberada del reloj: una prueba falló con 10 frente a 9 esperado. Se restauró el código
  correcto antes de la validación completa. Ver [LOOP-011](loops/LOOP-011-reloj-de-decaimiento.md).

Se prueban los cinco deltas, el umbral inclusivo de 20 s, temas repetidos/ausentes, límites, silencios
persistentes ante señales pasivas, reactivación explícita, reinicio, determinismo y ausencia de mutación.
El reloj tiene pruebas para 24 h exactas, varios días, fracción restante, migración de perfiles antiguos,
actualizaciones intermedias de ubicación, decaimiento antes de la señal y repetición sin doble decaimiento.
Entradas inválidas se rechazan atómicamente: temas desconocidos, señales incompletas, duraciones negativas,
NaN/infinitos, fechas inválidas, tiempo hacia atrás y relojes inconsistentes.

## Verificación final

Entorno: Node v24.21.0, pnpm 11.6.0, Linux x64.

```bash
pnpm -F @repo/shared test
pnpm -F @repo/shared typecheck
pnpm lint
pnpm typecheck
pnpm test
git diff --check
```

**507 pruebas correctas:** 258 shared, 34 Firestore, 71 admin y 144 Worker. Lint y typecheck globales
verdes. Salida en [`F3-08-validation.txt`](F3-08-validation.txt). Las pruebas del emulador usan puertos
locales y se ejecutaron fuera del sandbox con autorización. Revisión del módulo nuevo: sin imports de
proveedores, `fetch` ni SDKs de red; solo tipos y esquemas internos.

No se modificó UI ni se declara prueba en Expo Go. Gasto de IA del proyecto por esta tarea: **USD 0**;
las pruebas del Worker usan mocks. No se invocó el gateway desplegado ni se publicó contenido editorial.

## Contrato e integración pendiente

`UserProfile.interestsDecayedAt` es opcional para admitir documentos antiguos; los perfiles nuevos lo
inicializan. Los clientes lectores necesitan el esquema actualizado porque el anterior era estricto.
No se modifica el enum persistido de `UserEvent`. `InterestSignal` incorpora `reset` y `unmute` como
controles locales; el resto recibe temas del catálogo (y segundos para `dwell`). Ejemplo:

```ts
const decayed = updateInterests({ profile, now }); // al abrir la app
const learned = updateInterests({
  profile: decayed,
  signal: { type: 'dwell', topics: news.topics, seconds: 25 },
  now,
});
```

La app deberá mapear eventos y temas, deduplicar señales, mantener las últimas 200 lecturas y escribir
el perfil con debounce una vez por sesión, preservando cambios concurrentes. `personalization` controla
el ranking, no bloquea esta transición pura. La función no persiste ni captura eventos por sí misma.

Contrato documentado en [RELEVANCIA §7](../docs/domain/RELEVANCIA.md),
[MODELO-DATOS](../docs/architecture/MODELO-DATOS.md), [CONTRATOS-API](../docs/architecture/CONTRATOS-API.md)
y [handoff](../docs/handoffs/FASE-3.md), junto con tipos y esquemas.
