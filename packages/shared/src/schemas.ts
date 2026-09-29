import { z } from 'zod';

export const geoScopeSchema = z.enum(['local', 'nacional', 'regional', 'internacional', 'global']);
export const workflowSchema = z.enum(['borrador', 'en_revision', 'publicada', 'rechazada']);
export const certaintySchema = z.enum(['confirmada', 'en_desarrollo', 'disputada', 'retractada']);
export const contentOriginSchema = z.enum(['original_editorial', 'resumen_ia', 'cita_fuente']);
export const imageKindSchema = z.enum([
  'foto_real',
  'licencia_libre',
  'portada_generada',
  'ilustracion_ia',
]);

export const newsGeoSchema = z
  .object({
    scope: geoScopeSchema,
    countries: z.array(z.string()),
    cityIds: z.array(z.string()),
    regions: z.array(z.string()),
  })
  .strict();

export const sourceSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    organization: z.string(),
    url: z.string(),
    type: z.enum(['primaria', 'agencia', 'medio', 'redes', 'otro']),
    accessedAt: z.string(),
    supports: z.enum(['confirma', 'contradice', 'contexto']),
    note: z.string().optional(),
  })
  .strict();

export const newsImageSchema = z
  .object({
    kind: imageKindSchema,
    url: z.string(),
    credit: z.string(),
    license: z.string().optional(),
    sourceUrl: z.string().optional(),
    altText: z.string(),
    aiDisclosure: z.string().optional(),
  })
  .strict();

export const claimSchema = z
  .object({
    id: z.string(),
    text: z.string(),
    sourceIds: z.array(z.string()),
    status: z.enum(['respaldada', 'sin_respaldo', 'en_disputa']),
    suggestedByAi: z.boolean(),
  })
  .strict();

export const correctionEntrySchema = z
  .object({
    at: z.string(),
    kind: z.enum(['actualizacion', 'correccion', 'retractacion']),
    summary: z.string(),
    editorUid: z.string(),
  })
  .strict();

export const checklistItemSchema = z.enum([
  'fuentes_revisadas',
  'afirmaciones_con_respaldo',
  'titulo_no_sensacionalista',
  'imagen_etiquetada',
  'alcance_geo_revisado',
  'certeza_justificada',
]);

export const checklistSchema = z
  .object({
    fuentes_revisadas: z.boolean(),
    afirmaciones_con_respaldo: z.boolean(),
    titulo_no_sensacionalista: z.boolean(),
    imagen_etiquetada: z.boolean(),
    alcance_geo_revisado: z.boolean(),
    certeza_justificada: z.boolean(),
  })
  .strict();

export const enrichSuggestionSchema = z
  .object({
    topics: z.array(z.object({ key: z.string(), confidence: z.number() }).strict()),
    geo: newsGeoSchema,
    importance: z
      .object({
        value: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
        rationale: z.string(),
      })
      .strict(),
    claims: z.array(z.object({ text: z.string(), needsSource: z.boolean() }).strict()),
    summary: z.string(),
    sensationalismFlag: z.object({ flagged: z.boolean(), reason: z.string().optional() }).strict(),
    model: z.string(),
    costUsd: z.number(),
    createdAt: z.string(),
  })
  .strict();

export const newsSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    lead: z.string(),
    body: z.string(),
    bodyOrigin: contentOriginSchema,
    aiSummary: z
      .object({ text: z.string(), approvedBy: z.string(), approvedAt: z.string() })
      .strict()
      .optional(),
    topics: z.array(z.string()),
    geo: newsGeoSchema,
    importance: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    certainty: certaintySchema,
    certaintyNote: z.string().optional(),
    sources: z.array(sourceSchema),
    claims: z.array(claimSchema),
    image: newsImageSchema.optional(),
    workflow: workflowSchema,
    checklist: checklistSchema,
    aiSuggestions: enrichSuggestionSchema.optional(),
    corrections: z.array(correctionEntrySchema),
    version: z.number(),
    createdBy: z.string(),
    publishedBy: z.string().optional(),
    createdAt: z.string(),
    publishedAt: z.string().optional(),
    updatedAt: z.string(),
  })
  .strict();

export const userProfileSchema = z
  .object({
    uid: z.string(),
    displayName: z.string(),
    locationId: z.string(),
    interests: z.record(z.string(), z.number()),
    mutedTopics: z.array(z.string()),
    personalization: z.boolean(),
    readNewsIds: z.array(z.string()),
    updatedAt: z.string(),
  })
  .strict();

export const chatModeSchema = z.enum(['full', 'retrieval_only']);
export const apiEnvSchema = z.enum(['dev', 'demo']);

export const flagsSchema = z
  .object({
    killSwitch: z.boolean(),
    imageGenEnabled: z.boolean(),
    chatMode: chatModeSchema,
  })
  .strict();

export const flagsPatchSchema = flagsSchema.partial();

export const budgetSnapshotRequestSchema = z
  .object({
    providerBalanceUsd: z.number().finite().nonnegative(),
    note: z.string().max(500).optional(),
  })
  .strict();

export const userEventSchema = z
  .object({
    type: z.enum(['open', 'dwell', 'less_like_this', 'more_like_this', 'chat_topic', 'why_opened']),
    newsId: z.string().optional(),
    topic: z.string().optional(),
    seconds: z.number().optional(),
    locationId: z.string(),
    at: z.string(),
  })
  .strict();

export const MAX_INDEX_BATCH = 200;
export const MAX_SEARCH_TOP_K = 20;

const importanceSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);

export const indexInputSchema = z
  .object({
    id: z.string().min(1).max(200),
    title: z.string().min(1),
    lead: z.string(),
    body: z.string(),
    aiSummary: z.string().optional(),
    topics: z.array(z.string()),
    geo: newsGeoSchema,
    importance: importanceSchema,
    certainty: certaintySchema,
    certaintyNote: z.string().optional(),
    sources: z.array(z.object({ name: z.string(), url: z.string() }).strict()),
    publishedAt: z.string(),
  })
  .strict();

export const indexUpsertRequestSchema = z
  .object({ news: z.array(indexInputSchema).min(1).max(MAX_INDEX_BATCH) })
  .strict();

export const indexRebuildRequestSchema = z
  .object({ news: z.array(indexInputSchema).max(MAX_INDEX_BATCH) })
  .strict();

export const indexRemoveRequestSchema = z
  .object({ ids: z.array(z.string().min(1)).min(1).max(MAX_INDEX_BATCH) })
  .strict();

export const indexSearchRequestSchema = z
  .object({
    query: z.string().trim().min(1).max(500),
    countries: z.array(z.string()).optional(),
    topK: z.number().int().min(1).max(MAX_SEARCH_TOP_K).optional(),
  })
  .strict();
