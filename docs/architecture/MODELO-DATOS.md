# Modelo de datos

Fuente única de tipos: `packages/shared/src/types.ts`. Esquemas zod equivalentes en `packages/shared/src/schemas.ts`.
Este documento es la especificación; el código debe coincidir 1:1.

## 1. Catálogos (constantes en `packages/shared/src/catalogs/`)

### 1.1 Ubicaciones simuladas (`locations.ts`)

| id | Ciudad | País (ISO) | Región |
|----|--------|-----------|--------|
| `gt-guatemala` | Ciudad de Guatemala | GT | centroamerica |
| `gt-quetzaltenango` | Quetzaltenango | GT | centroamerica |
| `sv-san-salvador` | San Salvador | SV | centroamerica |
| `mx-cdmx` | Ciudad de México | MX | norteamerica |
| `us-nueva-york` | Nueva York | US | norteamerica |
| `co-bogota` | Bogotá | CO | sudamerica |
| `ar-buenos-aires` | Buenos Aires | AR | sudamerica |
| `es-madrid` | Madrid | ES | europa |

Dos ciudades de Guatemala permiten demostrar la diferencia **local vs nacional**. Regiones: `centroamerica`,
`norteamerica`, `sudamerica`, `caribe`, `europa`, `asia`, `africa`, `oceania`, `medio-oriente`.

### 1.2 Temas (`topics.ts`)

`politica, economia, seguridad, salud, educacion, tecnologia, ciencia, medio-ambiente, deportes, cultura,
sociedad, migracion, clima-desastres`. Cada tema tiene etiqueta en español y color.

### 1.3 Importancia editorial (`importance.ts`)

| Valor | Clave | Significado | Efecto |
|-------|-------|-------------|--------|
| 0 | `rutina` | Informativa, bajo impacto | Solo compite por relevancia personal |
| 1 | `relevante` | Interés amplio en su zona | — |
| 2 | `importante` | Afecta a mucha gente en su zona | Peso alto |
| 3 | `esencial` | Toda persona afectada debería saberlo (emergencias, salud pública, elecciones, desastres) | Entra al bloque no personalizado "Lo que debes saber" |

## 2. Tipos principales

```ts
export type GeoScope = 'local' | 'nacional' | 'regional' | 'internacional' | 'global';
export type Workflow = 'borrador' | 'en_revision' | 'publicada' | 'rechazada';
export type Certainty = 'confirmada' | 'en_desarrollo' | 'disputada' | 'retractada';
export type ContentOrigin = 'original_editorial' | 'resumen_ia' | 'cita_fuente';
export type ImageKind = 'foto_real' | 'licencia_libre' | 'portada_generada' | 'ilustracion_ia';

export interface NewsGeo {
  scope: GeoScope;
  countries: string[];      // ISO-2 afectados. Vacío si scope = 'global'.
  cityIds: string[];        // ids de catálogo; solo si scope = 'local'.
  regions: string[];        // claves de región afectadas.
}

export interface Source {
  id: string;
  name: string;             // "Prensa Libre", "Ministerio de Salud"
  organization: string;     // para medir independencia entre fuentes
  url: string;
  type: 'primaria' | 'agencia' | 'medio' | 'redes' | 'otro';
  accessedAt: string;       // ISO
  supports: 'confirma' | 'contradice' | 'contexto';
  note?: string;
}

export interface NewsImage {
  kind: ImageKind;
  url: string;
  credit: string;           // autor / "Generada por IA (modelo X)" / "Portada generada por la app"
  license?: string;         // CC BY 4.0, etc.
  licenseUrl?: string;      // enlace a los términos; opcional en noticias existentes
  sourceUrl?: string;
  altText: string;
  aiDisclosure?: string;    // obligatorio si kind = 'ilustracion_ia'
}

export interface Claim {
  id: string;
  text: string;
  sourceIds: string[];      // fuentes que la respaldan
  status: 'respaldada' | 'sin_respaldo' | 'en_disputa';
  suggestedByAi: boolean;
}

export interface CorrectionEntry {
  at: string;               // ISO
  kind: 'actualizacion' | 'correccion' | 'retractacion';
  summary: string;          // visible al lector
  editorUid: string;
}

export interface News {
  id: string;
  title: string;
  lead: string;             // entradilla, 1–2 oraciones
  body: string;             // markdown simple
  bodyOrigin: ContentOrigin;
  aiSummary?: { text: string; approvedBy: string; approvedAt: string }; // origin = resumen_ia
  topics: string[];         // 1–3 del catálogo
  geo: NewsGeo;
  importance: 0 | 1 | 2 | 3;
  certainty: Certainty;
  certaintyNote?: string;   // qué falta confirmar / en qué discrepan las fuentes
  sources: Source[];
  claims: Claim[];
  image?: NewsImage;
  workflow: Workflow;
  checklist: Record<ChecklistItem, boolean>;
  aiSuggestions?: EnrichSuggestion;  // lo que sugirió la IA, para auditoría (qué se aceptó y qué no)
  corrections: CorrectionEntry[];
  version: number;
  createdBy: string;
  publishedBy?: string;
  createdAt: string;
  publishedAt?: string;
  updatedAt: string;
  indexPending?: boolean;   // publicada pero aún sin confirmar en el índice del Worker; el portal la reintenta
}

export type ChecklistItem =
  | 'fuentes_revisadas'
  | 'afirmaciones_con_respaldo'
  | 'titulo_no_sensacionalista'
  | 'imagen_etiquetada'
  | 'alcance_geo_revisado'
  | 'certeza_justificada';

export interface EnrichSuggestion {
  topics: { key: string; confidence: number }[];
  geo: NewsGeo;
  importance: { value: 0 | 1 | 2 | 3; rationale: string };
  claims: { text: string; needsSource: boolean }[];
  summary: string;
  sensationalismFlag: { flagged: boolean; reason?: string };
  model: string;            // modelo/proveedor que respondió
  costUsd: number;
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  locationId: string;                 // del catálogo
  interests: Record<string, number>;  // tema -> peso [0, 10]
  mutedTopics: string[];              // "menos de esto" explícito
  personalization: boolean;           // toggle "ver sin personalizar" = false
  readNewsIds: string[];              // últimas 200
  updatedAt: string;
  interestsDecayedAt?: string;        // reloj de decaimiento diario; ISO 8601, opcional en perfiles antiguos
}

export interface UserEvent {
  type: 'open' | 'dwell' | 'less_like_this' | 'more_like_this' | 'chat_topic' | 'why_opened';
  newsId?: string;
  topic?: string;
  seconds?: number;
  locationId: string;
  at: string;
}
```

## 3. Colecciones Firestore

| Ruta | Contenido | Lee | Escribe |
|------|-----------|-----|---------|
| `admins/{uid}` | `{ email, addedAt }` (creado a mano en consola) | el propio admin | nadie desde cliente |
| `news/{id}` | `News` | autenticados si `workflow == 'publicada'`; admins todo | admins |
| `news/{id}/versions/{v}` | snapshot de `News` por versión publicada | autenticados | admins |
| `users/{uid}` | `UserProfile` | dueño; admins (solo agregados en comparador) | dueño |
| `users/{uid}/events/{id}` | `UserEvent` | dueño | dueño (solo create) |
| `config/public` | `{ feedWindowHours, rankingWeights, demoMode }` | autenticados | admins |

Configuración del feed (F3-02): `PublicFeedConfig` y `RankingWeights` se exportan desde `@repo/shared`.
`rankingWeights = { wI, wG, wA, wR }`, defaults `{ wI: 0.35, wG: 0.30, wA: 0.20, wR: 0.15 }`.
Cada peso es finito, de 0 a 1, y `wI + wG + wR > 0`; el motor normaliza su suma. `feedWindowHours`
debe ser finito y positivo (default 72); `demoMode` es booleano (default false).
`resolvePublicFeedConfig(value)` valida con zod y recupera defaults por campo si el documento está ausente
o es inválido. No hace lecturas ni escrituras. F3-01 escucha `config/public` y reabre la consulta
principal cuando cambia la ventana. El hook móvil `useNewsFeed()` escucha dos consultas de `news`, ambas
con `workflow == 'publicada'`: una con `publishedAt` dentro de `feedWindowHours` y otra con
`importance == 3` de las últimas 72 h. Fusiona por ID y versión, excluye retractadas y fechas futuras,
y reevalúa el tiempo para que las noticias caduquen sin recargar. Los índices compuestos declarados abajo
cubren esas consultas. El hook entrega `news`, configuración, estado `loading | ready | empty | error`,
mensaje de error y `retry`. `useProfile()` recibe `users/{uid}` por listener y cancela la suscripción al
cerrar sesión. Se reutilizan `newsSchema` y `userProfileSchema`; no cambian los documentos persistidos.

Desde F3-08 (función pura), `createDefaultProfile` inicializa `interestsDecayedAt`. El esquema actualizado
acepta documentos antiguos sin ese campo; `updateInterests` usa su `updatedAt` como referencia inicial y
devuelve el campo nuevo sin requerir una migración masiva. La app debe persistirlo al integrar las señales
y conservarlo al cambiar ubicación u otros campos. Los clientes que lean perfiles con el campo nuevo deben
usar el esquema actualizado (el esquema anterior era estricto).

`InterestSignal` y `UpdateInterestsInput` son contratos locales, validados por `interestSignalSchema` y
`updateInterestsInputSchema`. `updateInterests({ profile, signal?, now })` devuelve un `UserProfile`, sin
escribirlo. Acciones y decaimiento están en [RELEVANCIA §7](../domain/RELEVANCIA.md#7-aprendizaje-de-intereses-determinista).
El contrato persistido de `UserEvent` no cambia; `reset` y `unmute` son solo controles locales.

`RankFeedInput`, `RankedItem`, `RankedFeed` y `Reason` son contratos calculados en memoria, no colecciones.
Su semántica, esquema de salida, exclusiones, desempates y métricas están en
[`RELEVANCIA.md`](../domain/RELEVANCIA.md). El bloque `mustKnow` contiene todas las esenciales para que la UI
pueda mostrar cinco y ofrecer «ver todas». Desde F3-03, `reasons` contiene entre una y tres entradas
`{ code, text, contribution }`, ordenadas por contribución ponderada (incluye penalización de lectura).
Las garantías editoriales tienen aporte numérico 0 y un espacio reservado. El enum de `Reason.code`
incluye `importance_score`, `proximity_score`, `affinity_score`, `recency_score` y `available` para noticias
sin una condición del catálogo original; reglas y textos completos en RELEVANCIA §6. `reasonSchema` y
`rankedItemSchema` validan el contrato. No se escribe este resultado en Firestore.

`indexPending` lo escribe el portal en la misma transacción que publica (`true`) y lo borra al confirmar
`/admin/index/upsert`; si el Worker falla queda en `true` y el portal ofrece «Reintentar indexación». Los clientes
móviles pueden ignorarlo.

Índices compuestos: `news` por (`workflow`, `publishedAt desc`) y (`workflow`, `importance`, `publishedAt desc`).

## 4. Reglas de seguridad (esqueleto a implementar en F1-06)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function signedIn() { return request.auth != null; }
    function isAdmin() { return signedIn() && exists(/databases/$(db)/documents/admins/$(request.auth.uid)); }

    match /admins/{uid} { allow read: if signedIn() && request.auth.uid == uid; allow write: if false; }
    match /news/{id} {
      allow read: if isAdmin() || (signedIn() && resource.data.workflow == 'publicada');
      allow write: if isAdmin();
      match /versions/{v} { allow read: if signedIn(); allow write: if isAdmin(); }
    }
    match /users/{uid} {
      allow read, write: if signedIn() && request.auth.uid == uid;
      allow read: if isAdmin();
      match /events/{e} { allow create: if signedIn() && request.auth.uid == uid; allow read: if request.auth.uid == uid; }
    }
    match /config/{doc} { allow read: if signedIn(); allow write: if isAdmin(); }
  }
}
```

Probar las reglas con el emulador de Firestore (`@firebase/rules-unit-testing`) — es parte del DoD de F1-06.

## 5. D1 (Worker)

```sql
CREATE TABLE ai_calls (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  task TEXT NOT NULL,          -- embed | enrich | chat_answer | digest | image_generate
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  uid TEXT,
  cached INTEGER NOT NULL DEFAULT 0,
  outcome TEXT NOT NULL,       -- ok | error | blocked_budget | abstained
  env TEXT NOT NULL            -- dev | demo
);
CREATE INDEX ai_calls_task ON ai_calls(task);
CREATE TABLE rate_limits (uid TEXT, window_start TEXT, count INTEGER, PRIMARY KEY(uid, window_start));
CREATE TABLE budget_snapshots (ts TEXT PRIMARY KEY, provider_balance_usd REAL, note TEXT); -- saldo real leído del panel del proveedor
```

## 6. KV (Worker)

| Clave | Valor |
|-------|-------|
| `rag:index:v{n}` | arreglo de `IndexEntry` (ver CONTRATOS-API.md §3) |
| `rag:index:current` | número de versión vigente |
| `digest:{locationId}` | `{ text, newsIds, generatedAt, indexVersion }` |
| `chat:cache:{hash}` | respuesta completa, TTL 15 min; hash = pregunta normalizada + locationId + indexVersion |
| `flags` | `{ killSwitch: boolean, imageGenEnabled: boolean, chatMode: 'full' | 'retrieval_only' }` |
