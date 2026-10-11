# F4-01 — Pipeline del chat sin generación (pasos 1–7)

Fecha: 2026-10-11 · Responsable: Joaquín · Rama: `fase-4/f4-01-chat-pipeline` · Gasto de IA: USD 0 (`AI_MODE=mock`)

`POST /chat` (Worker) valida con zod, aplica rate limit, flags y presupuesto, clasifica la intención por reglas,
consulta la caché, recupera con embeddings y filtros por intención, se abstiene por debajo de τ y responde en
`retrieval_only` con las entradillas de las noticias encontradas. Ningún paso llama a un LLM. Detalle y decisiones
en [CHAT-RAG §2](../docs/domain/CHAT-RAG.md) («Implementación (F4-01)»).

| Archivo | Qué hace |
|---|---|
| `packages/shared/src/chat/intent.ts` | `classifyIntent`, `detectCountries`, `normalizeText` (trabajo previo que no existía) |
| `packages/shared/src/{types,schemas}.ts` | `ChatRequest`/`ChatResponse` y sus esquemas zod según CONTRATOS-API §4 |
| `services/api/src/rag/chat.ts` | Pipeline `runChat` (pasos 1–3, 5–7) |
| `services/api/src/rag/chatConfig.ts` | τ = 0.45, top-k = 6, boost regional, TTL 15 min, versión de caché |
| `services/api/src/rag/search.ts` | `rankEntries` acepta un boost por país que solo reordena |
| `services/api/src/ai/gateway.ts` | `chatPolicy` (kill switch + modo efectivo por presupuesto) y `recordAbstention` |
| `services/api/src/routes/chat.ts` | Ruta con `requireAuth` |

## Criterios de aceptación

| Criterio | Estado | Evidencia |
|---|---|---|
| CA1: pruebas de intención ≥ 90 % correctas | ☑ 30/30 (100 %) | `packages/shared/src/chat/intent.test.ts`: 30 frases con las cuatro intenciones y los cuatro casos del enunciado; la prueba falla por debajo de 90 % y lista las frases mal clasificadas |
| CA2: pregunta fuera de corpus → `abstain` sin fila de LLM | ☑ | `services/api/src/routes/chat.test.ts` «abstains on an off-corpus question…»: `mode = 'abstain'`, aviso del doc, `generatedBy = null`; en el ledger no hay ninguna fila `chat_answer` salvo la de `outcome = 'abstained'` con costo y tokens 0 |
| CA3: segunda pregunta idéntica → `cached = true` | ☑ | «serves an identical second question from the cache…»: la segunda respuesta trae `cached = true`, `costUsd = 0` y no agrega filas al ledger (ni siquiera de embedding) |

Otras pruebas de la ruta: 401 sin token; 422 por mensaje > 500, historia > 6 y ubicación desconocida; 429 en el
mensaje 21 de la hora; mayúsculas y tildes comparten caché; la caché no se comparte entre ubicaciones ni versiones
del índice; certeza heredada y aviso para `en_desarrollo`; retractada excluida aun con su texto exacto; filtro
`otro_pais` en ambos sentidos (GT pregunta por Argentina → no usa una noticia de GT; AR pregunta por Guatemala → sí);
`blocked` con kill switch (sin embedding) y con presupuesto `hard` en dev; `debug` solo en `env=dev`.

**Mutaciones** (aplicadas y revertidas): quitar el umbral τ hace fallar 5 pruebas, incluida CA2; desactivar la
lectura de caché hace fallar 2, incluida CA3.

```text
pnpm lint             OK
pnpm typecheck        OK
pnpm test             OK: shared 273, Firestore 60, admin 71, Worker 163 (567 pruebas)
```

## Notas para las tareas siguientes

- **F4-02:** el rate limit ya se consume en el paso 1 de la ruta y el gateway vuelve a consumirlo en cada
  `chat_answer` con `uid`. Al conectar la generación hay que evitar el doble conteo (p. ej., llamar al gateway con
  una opción que indique que el límite ya se aplicó).
- **F4-04 y demo en mock:** con `AI_MODE=mock` los embeddings son un hash del texto, así que cualquier pregunta
  natural se abstiene; solo el texto exacto de una noticia la recupera. La UI se puede construir en mock (los
  cuatro modos se pueden forzar), pero los cuatro casos del enunciado solo se ven con embeddings reales.
- **F4-05/06:** τ = 0.45 sigue sin calibrar; F1-09 midió 0.56–0.62 para aciertos y 0.41 como tope sin noticia
  válida con bge-m3. Las perillas están en `chatConfig.ts`; cada cambio requiere un LOOP.
- No se probó contra el Worker desplegado: hace falta un token real de Firebase y no se desplegó esta rama.
