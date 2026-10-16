# Entrega — AI Assisted News App (Proyecto 2, Responsible AI · UVG)

Corte: 2026-10-16. Resumen honesto de lo que se entrega: lo que tiene evidencia está enlazado; lo que no, aparece como
pendiente. El equipo cerró la entrega con el estado actual y **sin el recorrido de pruebas con los teléfonos**.

## 1. Qué se entrega y dónde está

| Pieza | Dónde | Estado verificado |
|---|---|---|
| App móvil (Expo, compatible con Expo Go) | `apps/mobile` | Código y pruebas; probada en un iPhone 16 Pro Max, no en Android |
| Portal editorial (SvelteKit) | `apps/admin`, <https://ai-news-app-f24cf.web.app> | Responde 200; flujo editorial con pruebas y e2e |
| API (Cloudflare Worker) | `services/api`, <https://news-api.diegovalenzuela.workers.dev> | `/health`: `aiMode: live`, índice v19 |
| Ranking, contratos y reglas editoriales | `packages/shared` | Pruebas automáticas |
| Evaluaciones del chat | `evals/`, resultados en `evidence/evals/` | Set de 34 casos y 3 de inyección, en vivo |
| Decisiones, fases y evidencia | [`docs/PLAN.md`](PLAN.md), [14 ADR](architecture/DECISIONES.md), [4 handoffs](handoffs/), `evidence/` | — |
| Responsible AI | [`RAI-MATRIZ.md`](responsible-ai/RAI-MATRIZ.md), [18 loops](../evidence/loops/), [`labs/jev/`](../labs/jev/) | Ver §3 |

Calidad del código: lint y typecheck sin errores y 680 pruebas en verde (corrida del 2026-10-15); CI de `main` en verde el
2026-10-16. Esas pruebas son la evidencia de casi todo; no sustituyen una prueba en teléfono.

## 2. Checklist del enunciado

Cumple, con evidencia enlazada en [PLAN §1](PLAN.md): ubicación simulada (sin GPS), chat como pantalla inicial y temporal,
las cuatro consultas del chat, fuentes y certeza heredada de la base de datos, publicación en el portal con procedencia,
flujo de imágenes sin confundir IA con evidencia, y control de costos.
**Parcial:** login con Google en la app y en el portal (las capturas están fuera del repo), feed con jerarquía visual,
vista de lectura, aprendizaje de intereses y forma de probar en clase (túnel y Plan B nativo, [ADR-014](architecture/DECISIONES.md);
no se ensayó con compañeros).

## 3. Lo que quedó parcial o pendiente, y por qué

- **Capturas y mediciones en teléfono: ninguna se hizo** ([lista](../evidence/CAPTURAS-PENDIENTES.md), 55 ítems). Queda
  sin medir F3-02 CA2 (ranking < 20 ms), F3-09 (cambio de ubicación < 300 ms) y F3-10 (dos teléfonos < 5 s); sin probar el chat
  en Android; y sin accesibilidad (F3-12). Por eso las celdas ◐ de la matriz RAI siguen en ◐. No hay teléfono de gama media.
- **Corpus editorial: 53 noticias publicadas, no las 55 que pide F2-11 CA1** (50 vigentes y 3 retractadas, visibles con su
  corrección). Tres editoriales quedaron **retenidas por revisión humana**: `ed-gt-004` y `ed-co-002` por vigencia del hecho y
  `ed-sv-001` por tener una sola fuente. Se **despublicó un duplicado** (`cGGX…`, copia de `ed-us-001`). Detalle:
  [`F2-11-corpus-prod.md`](../evidence/F2-11-corpus-prod.md). F2-11 CA1 queda PARCIAL.
- **Demo:** 0 de 3 ensayos generales, sin videos de respaldo, `demo:prepare` sin correr en producción y sin guion paso a paso
  de las secciones 1, 2 y 6 a 10 ([pendientes](ops/DEMO-RUNBOOK.md)).
- **Tags:** solo existe `fase-1-done`; los demás se crean tras el merge.
- **Menores:** `enrich.v2` y `enrich` con Haiku 5.5 sin medir; la tabla «IA sugirió vs editor publicó» sin hacer (las
  editoriales se publicaron sin el asistente de IA); la evidencia de F1 está fuera del repo; algunos loops se hicieron con otro
  agente (Codex), no con Claude Code; el motivo de pasar de Haiku 4.5 a 5.5 no quedó escrito ([ADR-012](architecture/DECISIONES.md)).

## 4. Limitaciones declaradas

- **La noticia no guarda la fecha del hecho**, solo cuándo se publicó: una noticia vieja publicada hoy parece reciente
  ([LOOP-017](../evidence/loops/LOOP-017-falta-de-fecha-del-hecho.md)). Propuesta futura: campo `eventDate`.
- **Nada detecta noticias duplicadas** ([LOOP-018](../evidence/loops/LOOP-018-duplicados-sin-deteccion.md)).
- **Las evaluaciones son muestras pequeñas:** una corrida por versión, 3 casos de inyección y el modelo no es determinista
  (Haiku 5.5 rechaza `temperature`); parte de una corrida salió de caché. El umbral de abstención τ no se calibró.
- La ilustración con IA no tiene proveedor ([ADR-011](architecture/DECISIONES.md)); solo hay portada tipográfica y fotos libres.

## 5. Gasto de IA

Tope: USD 20. **Según el ledger: USD 0.0605** (`GET /admin/costs`). **Según la consola de Anthropic: USD 0.06** de gasto; la
diferencia es menor al 1 % y cae en el redondeo a centavos. **Saldo registrado: USD 19.94**, calculado como 20 − 0.06; no se
leyó el saldo exacto de la consola. La reserva de USD 7 para la demo está intacta (ningún gasto con `env=demo`) y la
estimación de la demo es USD 0.075, es decir, la reserva la cubre 92.8 veces ([PRESUPUESTO-IA](ops/PRESUPUESTO-IA.md)).

## 6. Lo que falta antes de la presentación

Ensayos 1 a 3 y reinstalar el Plan B en los iPhone después del segundo (la firma gratuita vence a los 7 días); videos de
respaldo; probar el chat en Android; correr `pnpm demo:prepare` el día antes y ajustar la ventana del feed si hace falta
([ADR-013](architecture/DECISIONES.md)); desplegar el Worker con `ENV=demo` y comprobar `/health`; medir F3-02 y F3-09 con
el log de desarrollo; escribir los guiones pendientes; confirmar la fecha y que la key de Anthropic (vence el 2026-10-29)
siga vigente. Lista completa: [DEMO-RUNBOOK §6](ops/DEMO-RUNBOOK.md).
