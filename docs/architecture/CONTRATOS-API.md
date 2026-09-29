# Contratos del Worker (`services/api`)

Base URL: `https://news-api.<subdominio>.workers.dev`. Todas las rutas (excepto `/health`) exigen
`Authorization: Bearer <Firebase ID token>`. Errores con forma `{ error: { code: string, message: string } }`.
Validación con zod; esquemas exportados desde `packages/shared/src/schemas.ts`.

Códigos de error comunes: `unauthorized` (401), `forbidden` (403), `not_found` (404), `invalid_input` (422),
`rate_limited` (429), `budget_blocked` (503, kill switch activo), `provider_error` (502), `internal_error` (500,
sin detalles internos; el detalle va al log del Worker).

## 1. Salud y operación

### `GET /health`
`200 { ok: true, indexVersion: number, flags: Flags, env: 'dev' | 'demo' }`

### `GET /admin/costs` (admin)
```json
{
  "totalUsd": 3.41,
  "byTask": { "enrich": 1.2, "chat_answer": 2.1, "digest": 0.11, "embed": 0, "image_generate": 0 },
  "byDay": [{ "day": "2026-10-01", "usd": 0.4 }],
  "calls": { "total": 812, "cached": 190, "abstained": 77, "blocked": 0 },
  "budget": {
    "limitUsd": 20, "reserveUsd": 7, "warnUsd": 8, "softUsd": 11, "hardUsd": 13,
    "level": "normal", "lastProviderBalance": 16.2
  },
  "avgCostPerCall": { "enrich": 0.004, "chat_answer": 0.003 }
}
```
`byTask` siempre trae las cinco tareas (0 si no hubo gasto). `budget.level` es `normal | warn | soft | hard | exhausted`
según el total del ledger (umbrales en PRESUPUESTO-IA.md §2; `exhausted` = ≥ `limitUsd`, bloquea también `env=demo`).
`lastProviderBalance` es `null` si nunca se registró un saldo. `avgCostPerCall` solo incluye tareas con llamadas pagadas
(`outcome = ok`, no cacheadas). Tipo: `CostsResponse` en `packages/shared`.

### `POST /admin/flags` (admin)
Body `Partial<Flags>` (campos desconocidos o valores inválidos → `422 invalid_input`). Cambia kill switch, generación de
imágenes, modo del chat. Responde `200` con los flags resultantes completos.

### `POST /admin/budget-snapshot` (admin)
Body `{ providerBalanceUsd: number >= 0, note?: string }`. Registro manual del saldo real que muestra el panel del
proveedor. Responde `200 { ts, providerBalanceUsd, note }`.

### `POST /admin/ai/selftest` (admin)
Sin body. Una llamada mínima (`chat_answer`, ≤ 16 tokens de salida) a través del gateway para validar de punta a punta
proveedor, costo y ledger. Responde `200 { text, provider, model, usage: { inputTokens, outputTokens }, costUsd }`.
Con `AI_MODE=mock` devuelve un fixture y `provider = 'mock'`. Cuenta contra el rate limit de chat del admin.

## 2. Enriquecimiento editorial

### `POST /admin/enrich` (admin)
Request:
```json
{ "newsId": "abc", "title": "...", "lead": "...", "body": "...", "sources": [{ "name": "...", "url": "..." }] }
```
Response `200 EnrichSuggestion` (tipo en MODELO-DATOS.md). Una sola llamada de IA. Si el mismo `newsId` con el mismo
hash de contenido ya fue enriquecido, devuelve la sugerencia cacheada (costo 0).

### `POST /admin/image/search` (admin)
Request `{ query: string }` → `200 { results: { thumbUrl, url, title, creator, license, licenseUrl, sourceUrl }[] }`.
Consulta Openverse y Wikimedia Commons. Sin IA.

### `POST /admin/image/generate` (admin, deshabilitado por defecto)
Request `{ newsId, prompt }` → `200 { url, model, costUsd, aiDisclosure }`. Rechaza con `forbidden` si
`flags.imageGenEnabled = false`. El prompt se envuelve con restricciones fijas (ver IMAGENES.md §4).

## 3. Índice RAG

### `POST /admin/index/upsert` (admin)
Request: `{ news: IndexInput[] }` donde
```ts
interface IndexInput {
  id: string; title: string; lead: string; body: string; aiSummary?: string;
  topics: string[]; geo: NewsGeo; importance: 0|1|2|3; certainty: Certainty;
  certaintyNote?: string; sources: { name: string; url: string }[]; publishedAt: string;
}
```
El Worker calcula embedding de `title + lead + primeros 1200 caracteres de body` y guarda:
```ts
interface IndexEntry extends Omit<IndexInput, 'body'> {
  excerpt: string;          // primeros 1200 caracteres de body
  embedding: number[];      // dimensión según modelo (bge-m3 = 1024)
  indexedAt: string;
}
```
Response `200 { indexVersion, upserted: number, invalidatedDigests: string[] }`.

### `POST /admin/index/remove` (admin)
Request `{ ids: string[] }`. Se usa al retractar o despublicar.

### `POST /admin/index/rebuild` (admin)
Request `{ news: IndexInput[] }` con **todo** el corpus publicado. Reemplaza el índice. Útil si KV y Firestore divergen.

## 4. Chat

### `POST /chat`
Request:
```json
{
  "message": "¿Qué pasó hoy en mi zona?",
  "locationId": "gt-guatemala",
  "history": [{ "role": "user", "content": "..." }, { "role": "assistant", "content": "..." }]
}
```
`history` máximo 6 turnos, solo texto; el cliente la mantiene en memoria y se pierde al cerrar la app.

Response:
```ts
interface ChatResponse {
  mode: 'answer' | 'abstain' | 'digest' | 'retrieval_only' | 'blocked';
  blocks: {
    text: string;
    newsIds: string[];                 // siempre ⊆ noticias recuperadas
    certainty: Certainty | 'mixta';    // heredada de la(s) noticia(s), nunca del modelo
  }[];
  sources: { newsId: string; title: string; certainty: Certainty; publishedAt: string; outlets: string[] }[];
  notice?: string;                     // p.ej. "Hay información en desarrollo", "No encontré noticias publicadas sobre eso"
  generatedBy: { provider: string; model: string } | null;  // null si no hubo LLM
  cached: boolean;
  costUsd: number;                     // visible en modo demo
  debug?: { intent: string; topScores: number[]; threshold: number };  // solo env=dev
}
```

### `GET /digest/:locationId`
Response `ChatResponse` con `mode = 'digest'`. Precalculado; si no existe o es de un índice viejo, se regenera una vez.

## 5. Mocks

Con `AI_MODE=mock` todos los endpoints responden con fixtures de `services/api/src/ai/mocks/` y registran costo 0 con
`provider = 'mock'`. Las fases 2, 3 y 4 deben poder desarrollar la UI completa en modo mock.
