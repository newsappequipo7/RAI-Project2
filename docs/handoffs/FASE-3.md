# Handoff FASE-3 → FASE-4 (por completar al cerrar la fase 3)

Responsable: Nelson · Estado: **en curso** · Fecha de cierre y tag: pendientes

## 1. Qué quedó funcionando (demostrable)
- F3-02: `rankFeed` puro en `@repo/shared`, configuración con defaults y métricas de diversidad.
- F3-03: cada ítem de `rankFeed` incluye 1–3 explicaciones por código, ordenadas por contribución efectiva.
- No hay integración de pantallas todavía. La fase no está cerrada.

## 2. Cómo correrlo desde cero
Con Node 24 y pnpm 11.6.0:

```bash
pnpm install --frozen-lockfile
pnpm lint && pnpm typecheck
pnpm -F @repo/shared test
pnpm -F @repo/shared exec tsx scripts/benchmark-ranking.ts
```

El ranking no requiere variables de entorno, Firestore, Worker ni créditos. El benchmark anterior es de
escritorio, no sustituye CA2 en teléfono. Integración Expo Go: pendiente de las siguientes tareas.

## 3. Estado de tareas
| ID | Estado | Evidencia | Nota |
|----|--------|-----------|------|
| F3-02 | ◐ | [Evidencia](../../evidence/F3-02-ranking.md), [LOOP-009](../../evidence/loops/LOOP-009-ranking-cuotas-y-diversidad.md) | CA1 automatizado; CA2 pendiente en teléfono real |
| F3-03 | ☑ | [Evidencia](../../evidence/F3-03-explanations.md), [LOOP-010](../../evidence/loops/LOOP-010-catalogo-incompleto-de-razones.md) | CA1 verificado para feed y esenciales de las cuatro personas; panel visual en F3-06 |
| F3-01, F3-04 … F3-12 | ☐ | | No implementadas todavía |

## 4. Desviaciones respecto a contratos o docs
- Contratos nuevos de ranking, razones y configuración en `types.ts`/`schemas.ts`, documentados en
  `RELEVANCIA.md`, `MODELO-DATOS.md` y referenciados desde `CONTRATOS-API.md`.
- Modo sin personalización ignora también lecturas para cumplir igualdad de orden entre cuentas.
- `mustKnow` conserva todas las esenciales; límite visual de cinco + «ver todas» corresponde a F3-04.
- Diversidad conserva cuotas y separadores futuros; si no hay temas suficientes, conserva todas las noticias.
- F3-03 amplía `Reason.code` con cuatro explicaciones del aporte dominante y `available` para score cero.
  Se requiere al menos una razón en la salida pública (zod). Contribución = peso efectivo × componente ×
  penalización; esenciales/cuotas reservan un espacio con contribución 0 porque no añaden puntos.
  Tipos, esquemas y documentos de contratos actualizados en la misma tarea.

## 5. Deuda y problemas conocidos
- Alta: CA2 de F3-02 sin medir en Expo Go sobre teléfono de gama media; no marcar Done todavía.
- Media: razones disponibles; falta implementar el panel «¿Por qué veo esto?» en F3-06. Mostrar siempre las
  razones de garantía aunque su contribución sea 0; ese valor indica regla de inclusión, no aporte al score.
- Media: F3-01 debe escuchar `config/public`, usar `resolvePublicFeedConfig`, consultar solo publicadas y
  fusionar por ID. La ventana del feed pertenece a esa capa; esenciales usan 72 h fijas.
- Media: datos editoriales pueden quedar fuera de ventana. Nelson reportó una noticia publicada y pausó
  las restantes; no se modificó ningún checklist ni noticia desde el agente.

## 6. Gasto de IA de la fase
F3-02 y F3-03: USD 0 en llamadas a modelos desde este trabajo; no se invocaron proveedores reales ni el gateway desplegado.
Ledger/panel del proveedor: no consultados para esta tarea. Total de fase se verificará al cierre.

## 7. Qué necesita saber la siguiente persona antes de empezar
1. App y comparador deben importar el mismo `rankFeed` con las mismas entradas y `now` para obtener el mismo orden.
2. Esenciales no dependen del perfil; retractadas nunca aparecen en los bloques, pero F3-07 debe admitir enlace directo.
3. Pruebas automáticas y benchmark de escritorio no reemplazan evidencia de Expo Go en teléfono real.

## 8. Loops registrados en esta fase
- [LOOP-009](../../evidence/loops/LOOP-009-ranking-cuotas-y-diversidad.md): conservar cuotas y separadores al diversificar.
- [LOOP-010](../../evidence/loops/LOOP-010-catalogo-incompleto-de-razones.md): explicar noticias que no cumplen ningún umbral del catálogo original sin atribuirles condiciones falsas.
