# Handoff FASE-3 → FASE-4 (por completar al cerrar la fase 3)

Responsable: Nelson · Estado: **en curso** · Fecha de cierre y tag: pendientes

## 1. Qué quedó funcionando (demostrable)
- F3-02: `rankFeed` puro en `@repo/shared`, configuración con defaults y métricas de diversidad.
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
| F3-01, F3-03 … F3-12 | ☐ | | No implementadas todavía |

## 4. Desviaciones respecto a contratos o docs
- Contratos nuevos de ranking, razones y configuración en `types.ts`/`schemas.ts`, documentados en
  `RELEVANCIA.md`, `MODELO-DATOS.md` y referenciados desde `CONTRATOS-API.md`.
- Modo sin personalización ignora también lecturas para cumplir igualdad de orden entre cuentas.
- `mustKnow` conserva todas las esenciales; límite visual de cinco + «ver todas» corresponde a F3-04.
- Diversidad conserva cuotas y separadores futuros; si no hay temas suficientes, conserva todas las noticias.

## 5. Deuda y problemas conocidos
- Alta: CA2 de F3-02 sin medir en Expo Go sobre teléfono de gama media; no marcar Done todavía.
- Media: `reasons` vacío hasta F3-03; no exponer aún «¿Por qué veo esto?» al usuario.
- Media: F3-01 debe escuchar `config/public`, usar `resolvePublicFeedConfig`, consultar solo publicadas y
  fusionar por ID. La ventana del feed pertenece a esa capa; esenciales usan 72 h fijas.
- Media: datos editoriales pueden quedar fuera de ventana. Nelson reportó una noticia publicada y pausó
  las restantes; no se modificó ningún checklist ni noticia desde el agente.

## 6. Gasto de IA de la fase
F3-02: USD 0 en llamadas a modelos desde este trabajo; no se invocaron proveedores reales ni el gateway desplegado.
Ledger/panel del proveedor: no consultados para esta tarea. Total de fase se verificará al cierre.

## 7. Qué necesita saber la siguiente persona antes de empezar
1. App y comparador deben importar el mismo `rankFeed` con las mismas entradas y `now` para obtener el mismo orden.
2. Esenciales no dependen del perfil; retractadas nunca aparecen en los bloques, pero F3-07 debe admitir enlace directo.
3. Pruebas automáticas y benchmark de escritorio no reemplazan evidencia de Expo Go en teléfono real.

## 8. Loops registrados en esta fase
- [LOOP-009](../../evidence/loops/LOOP-009-ranking-cuotas-y-diversidad.md): conservar cuotas y separadores al diversificar.
