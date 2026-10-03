import type { AiTask, BudgetLevel } from './ai';

export type GeoScope = 'local' | 'nacional' | 'regional' | 'internacional' | 'global';
export type Workflow = 'borrador' | 'en_revision' | 'publicada' | 'rechazada';
export type Certainty = 'confirmada' | 'en_desarrollo' | 'disputada' | 'retractada';
export type ContentOrigin = 'original_editorial' | 'resumen_ia' | 'cita_fuente';
export type ImageKind = 'foto_real' | 'licencia_libre' | 'portada_generada' | 'ilustracion_ia';

export interface NewsGeo {
  scope: GeoScope;
  countries: string[]; // ISO-2 afectados. Vacío si scope = 'global'.
  cityIds: string[]; // ids de catálogo; solo si scope = 'local'.
  regions: string[]; // claves de región afectadas.
}

export interface Source {
  id: string;
  name: string; // "Prensa Libre", "Ministerio de Salud"
  organization: string; // para medir independencia entre fuentes
  url: string;
  type: 'primaria' | 'agencia' | 'medio' | 'redes' | 'otro';
  accessedAt: string; // ISO
  supports: 'confirma' | 'contradice' | 'contexto';
  note?: string;
}

export interface NewsImage {
  kind: ImageKind;
  url: string;
  credit: string; // autor / "Generada por IA (modelo X)" / "Portada generada por la app"
  license?: string; // CC BY 4.0, etc.
  sourceUrl?: string;
  altText: string;
  aiDisclosure?: string; // obligatorio si kind = 'ilustracion_ia'
}

export interface Claim {
  id: string;
  text: string;
  sourceIds: string[]; // fuentes que la respaldan
  status: 'respaldada' | 'sin_respaldo' | 'en_disputa';
  suggestedByAi: boolean;
}

export interface CorrectionEntry {
  at: string; // ISO
  kind: 'actualizacion' | 'correccion' | 'retractacion';
  summary: string; // visible al lector
  editorUid: string;
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
  model: string; // modelo/proveedor que respondió
  costUsd: number;
  createdAt: string;
}

export interface News {
  id: string;
  title: string;
  lead: string; // entradilla, 1–2 oraciones
  body: string; // markdown simple
  bodyOrigin: ContentOrigin;
  aiSummary?: { text: string; approvedBy: string; approvedAt: string }; // origin = resumen_ia
  topics: string[]; // 1–3 del catálogo
  geo: NewsGeo;
  importance: 0 | 1 | 2 | 3;
  certainty: Certainty;
  certaintyNote?: string; // qué falta confirmar / en qué discrepan las fuentes
  sources: Source[];
  claims: Claim[];
  image?: NewsImage;
  workflow: Workflow;
  checklist: Record<ChecklistItem, boolean>;
  aiSuggestions?: EnrichSuggestion; // lo que sugirió la IA, para auditoría (qué se aceptó y qué no)
  corrections: CorrectionEntry[];
  version: number;
  createdBy: string;
  publishedBy?: string;
  createdAt: string;
  publishedAt?: string;
  updatedAt: string;
  indexPending?: boolean; // publicada pero aún sin confirmar en el índice del Worker; se reintenta desde el portal
}

export interface UserProfile {
  uid: string;
  displayName: string;
  locationId: string; // del catálogo
  interests: Record<string, number>; // tema -> peso [0, 10]
  mutedTopics: string[]; // "menos de esto" explícito
  personalization: boolean; // toggle "ver sin personalizar" = false
  readNewsIds: string[]; // últimas 200
  updatedAt: string;
}

export interface UserEvent {
  type: 'open' | 'dwell' | 'less_like_this' | 'more_like_this' | 'chat_topic' | 'why_opened';
  newsId?: string;
  topic?: string;
  seconds?: number;
  locationId: string;
  at: string;
}

export type ChatMode = 'full' | 'retrieval_only';
export type ApiEnv = 'dev' | 'demo';
/** `mock` = fixtures and fake embeddings, no provider spend; `live` = real models. */
export type AiMode = 'mock' | 'live';

export interface Flags {
  killSwitch: boolean;
  imageGenEnabled: boolean;
  chatMode: ChatMode;
}

export interface HealthResponse {
  ok: true;
  indexVersion: number;
  flags: Flags;
  env: ApiEnv;
  aiMode: AiMode;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}

export interface CostsResponse {
  totalUsd: number;
  byTask: Record<AiTask, number>;
  byDay: { day: string; usd: number }[];
  calls: { total: number; cached: number; abstained: number; blocked: number };
  budget: {
    limitUsd: number;
    reserveUsd: number;
    warnUsd: number;
    softUsd: number;
    hardUsd: number;
    level: BudgetLevel;
    lastProviderBalance: number | null;
  };
  avgCostPerCall: Partial<Record<AiTask, number>>;
}

export interface BudgetSnapshot {
  ts: string;
  providerBalanceUsd: number;
  note: string | null;
}

export interface AiSelftestResponse {
  text: string;
  provider: string;
  model: string;
  usage: { inputTokens: number; outputTokens: number };
  costUsd: number;
}

export interface IndexSource {
  name: string;
  url: string;
}

export interface IndexInput {
  id: string;
  title: string;
  lead: string;
  body: string;
  aiSummary?: string;
  topics: string[];
  geo: NewsGeo;
  importance: 0 | 1 | 2 | 3;
  certainty: Certainty;
  certaintyNote?: string;
  sources: IndexSource[];
  publishedAt: string;
}

export interface IndexEntry extends Omit<IndexInput, 'body'> {
  excerpt: string;
  embedding: number[];
  indexedAt: string;
}

export interface IndexUpsertResponse {
  indexVersion: number;
  upserted: number;
  invalidatedDigests: string[];
}

export interface IndexRemoveResponse {
  indexVersion: number;
  removed: number;
  invalidatedDigests: string[];
}

export interface IndexSearchHit {
  id: string;
  title: string;
  certainty: Certainty;
  score: number;
}

export interface IndexSearchResponse {
  indexVersion: number;
  hits: IndexSearchHit[];
}
