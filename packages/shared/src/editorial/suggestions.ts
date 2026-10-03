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
