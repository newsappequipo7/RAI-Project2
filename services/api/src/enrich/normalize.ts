import {
  COUNTRIES_ES,
  LOCATIONS,
  REGIONS,
  TOPICS,
  type EnrichSuggestion,
  type GeoScope,
} from '@repo/shared';
import { z } from 'zod';
import { providerError } from '../errors';
import { ENRICH_MAX_CLAIMS } from '../ai/prompts/enrich.v1';

const MAX_TOPICS = 3;
const MAX_SUMMARY_SENTENCES = 2;
const MAX_REASON_CHARS = 240;

/** What the model returns. Lenient on extra keys, strict on the shapes we rely on. */
const modelOutputSchema = z.object({
  topics: z.array(z.object({ key: z.string(), confidence: z.coerce.number() })).default([]),
  geo: z.object({
    scope: z.string(),
    countries: z.array(z.string()).default([]),
    cityIds: z.array(z.string()).default([]),
    regions: z.array(z.string()).default([]),
  }),
  importance: z.object({ value: z.coerce.number(), rationale: z.string().default('') }),
  claims: z
    .array(z.object({ text: z.string(), needsSource: z.boolean().default(true) }))
    .default([]),
  summary: z.string().default(''),
  sensationalismFlag: z
    .object({ flagged: z.boolean().default(false), reason: z.string().optional() })
    .default({ flagged: false }),
});

export type ModelOutput = z.infer<typeof modelOutputSchema>;

const SCOPES: GeoScope[] = ['local', 'nacional', 'regional', 'internacional', 'global'];
const TOPIC_KEYS = new Set(TOPICS.map((topic) => topic.key));
const COUNTRY_ISO = new Set(COUNTRIES_ES.map((country) => country.iso));
const CITY_IDS = new Set(LOCATIONS.map((location) => location.id));
const REGION_KEYS = new Set<string>(REGIONS);

/** Pulls the JSON object out of the model text, tolerating a code fence or surrounding prose. */
export function parseModelJson(text: string): ModelOutput {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw providerError('The model did not return JSON');

  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw providerError('The model returned invalid JSON');
  }

  const parsed = modelOutputSchema.safeParse(raw);
  if (!parsed.success) throw providerError('The model output does not match the expected shape');
  return parsed.data;
}

const unique = <T>(values: T[]) => [...new Set(values)];

function limitSentences(text: string, max: number): string {
  const sentences = text
    .trim()
    .split(/(?<=[.!?…])\s+/)
    .filter(Boolean);
  return sentences.slice(0, max).join(' ');
}

/**
 * Code, not the model, has the last word on what is allowed: topics and geography outside the
 * catalogs are dropped, numbers are clamped, and sizes are capped. The editor still reviews it.
 */
export function normalizeSuggestion(
  output: ModelOutput,
  meta: { model: string; costUsd: number; createdAt: string },
): EnrichSuggestion {
  const topics = unique(
    output.topics
      .filter((topic) => TOPIC_KEYS.has(topic.key.trim()))
      .sort((a, b) => b.confidence - a.confidence)
      .map((topic) => topic.key.trim()),
  )
    .slice(0, MAX_TOPICS)
    .map((key) => {
      const original = output.topics.find((topic) => topic.key.trim() === key);
      const confidence = Math.min(1, Math.max(0, original?.confidence ?? 0));
      return { key, confidence: Math.round(confidence * 100) / 100 };
    });

  const requestedScope = output.geo.scope.trim().toLowerCase();
  let scope: GeoScope = SCOPES.includes(requestedScope as GeoScope)
    ? (requestedScope as GeoScope)
    : 'nacional';
  let countries = unique(output.geo.countries.map((iso) => iso.trim().toUpperCase())).filter(
    (iso) => COUNTRY_ISO.has(iso),
  );
  let regions = unique(output.geo.regions.map((region) => region.trim().toLowerCase())).filter(
    (region) => REGION_KEYS.has(region),
  );
  let cityIds = unique(output.geo.cityIds.map((id) => id.trim())).filter((id) => CITY_IDS.has(id));

  if (scope === 'global') {
    countries = [];
    regions = [];
    cityIds = [];
  } else if (scope !== 'local') {
    cityIds = [];
  } else if (cityIds.length === 0 && countries.length > 0) {
    scope = 'nacional'; // a local scope without a known city cannot be saved
  }

  const importance = Math.min(3, Math.max(0, Math.round(output.importance.value))) as 0 | 1 | 2 | 3;

  const seen = new Set<string>();
  const claims = output.claims
    .map((claim) => ({ text: claim.text.trim(), needsSource: claim.needsSource }))
    .filter((claim) => {
      const key = claim.text.toLowerCase();
      if (claim.text === '' || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, ENRICH_MAX_CLAIMS);

  const reason = output.sensationalismFlag.reason?.trim().slice(0, MAX_REASON_CHARS);

  return {
    topics,
    geo: { scope, countries, cityIds, regions },
    importance: { value: importance, rationale: output.importance.rationale.trim() },
    claims,
    summary: limitSentences(output.summary, MAX_SUMMARY_SENTENCES),
    sensationalismFlag: output.sensationalismFlag.flagged
      ? { flagged: true, ...(reason ? { reason } : {}) }
      : { flagged: false },
    model: meta.model,
    costUsd: meta.costUsd,
    createdAt: meta.createdAt,
  };
}
