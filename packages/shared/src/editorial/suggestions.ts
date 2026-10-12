import type { News } from '../types';

export type SuggestionField = 'topics' | 'geo' | 'importance' | 'claims' | 'summary';

export interface SuggestionComparison {
  field: SuggestionField;
  label: string;
  suggested: string;
  published: string;
  matches: boolean;
}

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value) => b.includes(value));

const norm = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase();

const list = (values: string[]) => (values.length > 0 ? values.join(', ') : '—');

/**
 * «La IA sugirió X, se publicó Y» (F2-04): what the model proposed next to what the editor kept.
 * It is the audit trail for the question «¿qué decisiones requieren criterio humano?».
 */
export function compareSuggestions(news: News): SuggestionComparison[] {
  const suggestion = news.aiSuggestions;
  if (!suggestion) return [];

  const suggestedTopics = [...suggestion.topics]
    .sort((a, b) => b.confidence - a.confidence)
    .map((topic) => topic.key);
  const geo = suggestion.geo;
  const includedClaims = suggestion.claims.filter((suggested) =>
    news.claims.some((claim) => norm(claim.text) === norm(suggested.text)),
  );
  const approved = news.aiSummary?.text;

  return [
    {
      field: 'topics',
      label: 'Temas',
      suggested: list(suggestedTopics),
      published: list(news.topics),
      matches: sameSet(suggestedTopics, news.topics),
    },
    {
      field: 'geo',
      label: 'Alcance geográfico',
      suggested: `${geo.scope} · ${list(geo.countries)}`,
      published: `${news.geo.scope} · ${list(news.geo.countries)}`,
      matches:
        geo.scope === news.geo.scope &&
        sameSet(geo.countries, news.geo.countries) &&
        sameSet(geo.cityIds, news.geo.cityIds) &&
        sameSet(geo.regions, news.geo.regions),
    },
    {
      field: 'importance',
      label: 'Importancia',
      suggested: String(suggestion.importance.value),
      published: String(news.importance),
      matches: suggestion.importance.value === news.importance,
    },
    {
      field: 'claims',
      label: 'Afirmaciones',
      suggested: `${suggestion.claims.length} sugeridas`,
      published: `${includedClaims.length} incluidas`,
      matches: includedClaims.length === suggestion.claims.length,
    },
    {
      field: 'summary',
      label: 'Resumen',
      suggested: suggestion.summary,
      published: approved ?? 'No se aprobó ningún resumen',
      matches: approved !== undefined && norm(approved) === norm(suggestion.summary),
    },
  ];
}

export interface SuggestionFieldStats {
  field: SuggestionField;
  label: string;
  compared: number;
  changed: number;
  /** Share of published news where the editor did not keep the AI suggestion; null without data. */
  changedRate: number | null;
}

export interface SuggestionAudit {
  /** Published news that kept their AI suggestions for audit. */
  audited: number;
  /** Published news without saved suggestions (written by hand or before F2-04). */
  withoutSuggestions: number;
  fields: SuggestionFieldStats[];
  rows: { id: string; title: string; comparisons: SuggestionComparison[] }[];
}

/**
 * F4-11, presentation section 7: across published news, how often the editor changed what the
 * AI suggested. This is the measurable side of «la IA sugiere, el humano decide».
 */
export function auditSuggestions(news: News[]): SuggestionAudit {
  const published = news.filter(({ workflow }) => workflow === 'publicada');
  const rows = published
    .filter(({ aiSuggestions }) => aiSuggestions !== undefined)
    .map((item) => ({ id: item.id, title: item.title, comparisons: compareSuggestions(item) }));
  const fields = (['topics', 'geo', 'importance', 'claims', 'summary'] as const).map((field) => {
    const comparisons = rows.flatMap(({ comparisons: list }) =>
      list.filter((comparison) => comparison.field === field),
    );
    const changed = comparisons.filter(({ matches }) => !matches).length;
    return {
      field,
      label: comparisons[0]?.label ?? field,
      compared: comparisons.length,
      changed,
      changedRate:
        comparisons.length === 0 ? null : Number((changed / comparisons.length).toFixed(4)),
    };
  });

  return {
    audited: rows.length,
    withoutSuggestions: published.length - rows.length,
    fields,
    rows,
  };
}
