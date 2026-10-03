# CLAUDE.md — AI Assisted News App (Proyecto 2, Responsible AI · UVG)

Este archivo es el punto de entrada para Claude Code. Es corto a propósito: el detalle vive en `docs/`.
Lee SIEMPRE este archivo completo y luego el documento de tu fase antes de escribir código.

## 1. Qué estamos construyendo (en una línea)

App móvil (iPhone + Android) de noticias personalizadas por **ubicación simulada**, con chat sobre las noticias
publicadas, y un **portal administrativo** donde una persona publica y verifica noticias. Todo con IA usada de forma
responsable y **≤ USD 20 en créditos de API de IA** (desarrollo + pruebas + presentación).

Enunciado original resumido y objetivos de evaluación: `docs/PLAN.md` §1.

## 2. Cómo orientarte (índice de documentos)

| Necesito…                                          | Leer                                              |
|----------------------------------------------------|---------------------------------------------------|
| Plan general, fases, orden, estado                 | `docs/PLAN.md`                                    |
| Fechas, quién hace qué, trabajo previo             | `docs/CRONOGRAMA.md`                              |
| Cuentas, secretos, máquinas (día 0)                | `docs/ops/SETUP-DIA-0.md`                         |
| Mi fase (tareas atómicas + criterios de aceptación)| `docs/phases/FASE-N-*.md`                         |
| Lo que dejó la persona anterior                    | `docs/handoffs/FASE-(N-1).md`                     |
| Arquitectura y flujo de datos                      | `docs/architecture/ARQUITECTURA.md`               |
| Colecciones Firestore, tipos, reglas               | `docs/architecture/MODELO-DATOS.md`               |
| Endpoints del Worker (contratos)                   | `docs/architecture/CONTRATOS-API.md`              |
| Decisiones tomadas y por qué (ADRs)                | `docs/architecture/DECISIONES.md`                 |
| Fórmula de relevancia, anti-burbuja, "¿Por qué?"   | `docs/domain/RELEVANCIA.md`                       |
| Estados de verificación, fuentes, correcciones     | `docs/domain/VERIFICACION-Y-FUENTES.md`           |
| Chat RAG, abstención, citas, incertidumbre         | `docs/domain/CHAT-RAG.md`                         |
| Imágenes (reales, libres, portada, IA)             | `docs/domain/IMAGENES.md`                         |
| Probar en iPhone sin cuenta Apple de pago          | `docs/ops/IOS-ANDROID-DISTRIBUCION.md`            |
| Presupuesto, gateway de IA, kill switch            | `docs/ops/PRESUPUESTO-IA.md`                      |
| Guion de la demo final (10 secciones)              | `docs/ops/DEMO-RUNBOOK.md`                        |
| Definition of Done, loops, evidencia               | `docs/process/ENGINEERING-LOOPS.md`               |
| Matriz Responsible AI (pregunta → feature → prueba)| `docs/responsible-ai/RAI-MATRIZ.md`               |
| Jev / TypeSafe (investigación verificada)          | `docs/research/JEV.md`                            |

No cargues todos los documentos a la vez. Lee el de tu fase y abre los demás solo cuando la tarea lo pida
(cada tarea de fase indica qué documento consultar).

## 3. Reglas de oro (no negociables)

1. **La IA trabaja al publicar; el código trabaja al leer.** El feed, el ranking y el orden se calculan con código
   (`packages/shared/ranking`). Ninguna pantalla de lectura llama a un LLM. El único uso de IA en tiempo de lectura
   es el chat, y aun ahí se evita cuando se puede (abstención, caché, digest precalculado).
2. **Toda llamada a un modelo pasa por el gateway** (`services/api/src/ai/gateway.ts`). Prohibido llamar a un
   proveedor de IA desde cualquier otro lugar. El gateway registra costo en D1 y aplica el kill switch.
3. **El modelo nunca decide la certeza de una noticia.** El estado `confirmada | en_desarrollo | disputada |
   retractada` lo pone un humano en el portal. El chat hereda ese estado de la base de datos; jamás lo infiere.
4. **Toda salida de IA visible al usuario está etiquetada** con su origen (`original_editorial`, `resumen_ia`,
   `respuesta_ia`, `imagen_ia`, `portada_generada`). Ver `docs/domain/VERIFICACION-Y-FUENTES.md` §4.
5. **App móvil compatible con Expo Go.** No agregar módulos nativos que Expo Go no incluya. Es lo que nos
   permite probar en iPhone sin cuenta Apple de pago. Si crees que necesitas uno, detente y escribe un ADR.
6. **Sin secretos en clientes.** Las API keys de IA solo existen como secrets del Worker. La config pública de
   Firebase sí puede ir en el cliente.
7. **Los contratos son ley.** Tipos en `packages/shared/src/types.ts`, esquemas zod en `packages/shared/src/schemas.ts`
   y endpoints en `docs/architecture/CONTRATOS-API.md`. Si necesitas cambiar un contrato: actualiza el doc, los
   tipos y registra el cambio en el handoff de tu fase.
8. **Nada está Done sin evidencia.** Ver `docs/process/ENGINEERING-LOOPS.md` §2.
9. **Claude Code no usa la API key del proyecto.** La key de Anthropic (tope USD 20) existe solo como secret del
   Worker. Si detectas `ANTHROPIC_API_KEY` del proyecto en el entorno local o en un archivo, detente y avisa.
10. **El repo es público.** Nunca escribas secretos en archivos versionados; solo nombres en `.env.example`.

## 4. Stack

- Monorepo `pnpm` workspaces. TypeScript `strict` en todo.
- `apps/mobile`: Expo (React Native) + expo-router + Firebase JS SDK. Versión de SDK = la que soporte Expo Go de la
  App Store al momento de crear el proyecto (verificar, ver doc de distribución).
- `apps/admin`: SvelteKit (SPA, `adapter-static`) en Firebase Hosting. Incluye la ruta puente de login móvil.
- `services/api`: Cloudflare Worker con Hono. D1 (ledger de costos y caché), KV (índice de búsqueda, digests),
  Workers AI (embeddings). LLM: Anthropic, `claude-haiku-4-5-20251001` por defecto (ADR-009), configurable por tarea.
- `packages/shared`: tipos, esquemas zod, catálogos (ubicaciones, temas), motor de ranking. Lo usan mobile y admin.
- Firebase: Authentication (Google) + Firestore (plan Spark, sin tarjeta).
- `evals/`: sets dorados y scripts de evaluación del chat y del ranking.

## 5. Comandos

```bash
pnpm install
pnpm -F shared test            # pruebas del motor de ranking y esquemas
pnpm -F mobile start           # Expo (usar --tunnel en redes de la U)
pnpm -F admin dev              # portal en localhost:5173
pnpm -F api dev                # Worker local con wrangler
pnpm -F api deploy
pnpm -F e2e run e2e             # e2e del portal con Playwright contra emuladores (1ª vez: pnpm -F e2e run install:browsers)
pnpm evals:chat                # corre el set dorado del chat (gasta créditos, ver PRESUPUESTO-IA.md §5)
pnpm lint && pnpm typecheck
```

Si un comando no existe todavía, créalo en la fase que corresponde (FASE-1 los define).

## 6. Cómo trabajar cada tarea (ciclo obligatorio)

1. Lee la tarea en tu archivo de fase y los documentos que referencia.
2. Escribe un plan corto (qué archivos tocas, cómo lo vas a probar) y muéstralo antes de implementar cambios grandes.
3. Implementa en pasos pequeños. Corre `typecheck` y pruebas después de cada paso.
4. Verifica contra los **criterios de aceptación** de la tarea, uno por uno.
5. Si una observación cambió una decisión, registra un loop: `/registrar-loop` (ver `.claude/commands/`).
6. Marca la tarea en `docs/PLAN.md` §6 (tabla de estado) con enlace a la evidencia.

## 7. Convenciones

- UI y contenido en español. Código, nombres de variables y commits en inglés.
- Commits: Conventional Commits (`feat(mobile): ...`, `fix(api): ...`). Un commit por tarea terminada como mínimo.
- Ramas: `fase-N/<tarea-id>-slug`. PR a `main` con checklist de DoD.
- IDs de tarea: `F1-03`, `F3-07`, etc. Úsalos en commits y evidencia.
- Fechas en ISO 8601 UTC en datos; en UI, zona `America/Guatemala`.
- Validación de entrada con zod en todos los endpoints y formularios.

## 8. Qué NO hacer

- No llamar a un LLM para ordenar, filtrar o paginar noticias.
- No generar imágenes fotorrealistas de hechos, ni de personas reales identificables.
- No mostrar respuestas del chat sin fuentes, ni fuentes que no estaban en lo recuperado.
- No usar GPS. La ubicación es siempre la simulada que el usuario elige.
- No gastar créditos en loops de prueba automáticos sin mocks (`AI_MODE=mock` existe para eso).
- No borrar noticias retractadas: se marcan y se mantienen visibles con su corrección.
