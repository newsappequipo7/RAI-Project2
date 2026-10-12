import { COUNTRIES_ES } from '../catalogs/countries-es';
import { findLocation, LOCATIONS } from '../catalogs/locations';

/** Chat intents from docs/domain/CHAT-RAG.md §2 step 3. Decided by rules, never by a model. */
export const CHAT_INTENTS = ['resumen', 'mi_region', 'otro_pais', 'tema'] as const;
export type ChatIntent = (typeof CHAT_INTENTS)[number];

export interface IntentResult {
  intent: ChatIntent;
  /** ISO codes named in the message other than the reader's country (only for `otro_pais`). */
  countries: string[];
  /**
   * The message asks for news in general, with no topic or other detail ("Resume lo más importante
   * de hoy"). Only a generic `resumen` or `mi_region` may be answered with the location digest.
   */
  generic: boolean;
}

/** Lowercase, without accents or punctuation, single-spaced: the form every rule matches against. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const SUMMARY_PHRASES = [
  'resume',
  'resumen',
  'resumeme',
  'resumir',
  'resumes',
  'que paso hoy',
  'que ha pasado',
  'que hay de nuevo hoy',
  'lo mas importante',
  'lo importante de hoy',
  'principales noticias',
  'noticias principales',
  'titulares',
  'ponme al dia',
  'ponerme al dia',
];

const REGION_PHRASES = [
  'mi zona',
  'mi pais',
  'mi ciudad',
  'mi region',
  'mi area',
  'mi localidad',
  'donde vivo',
  'aqui',
  'aca',
  'cerca',
  'por aca',
  'por aqui',
  'local',
  'locales',
];

/** Phrases that mention a country word without referring to the country. */
const COUNTRY_FALSE_FRIENDS = ['en espanol', 'al espanol', 'idioma espanol'];

/** Extra spellings people use for a country that are neither its name nor its demonym. */
const COUNTRY_ALIASES: Record<string, string[]> = {
  US: ['eeuu', 'ee uu', 'usa', 'eua'],
  GB: ['inglaterra'],
  GT: ['xela'],
  MX: ['cdmx'],
};

/** Feminine and plural forms of a Spanish demonym ("mexicano" → "mexicana", "mexicanos", …). */
export function demonymForms(demonym: string): string[] {
  const base = normalizeText(demonym);
  const stem = base.slice(0, -1);

  if (base.endsWith('o')) return [base, `${stem}a`, `${base}s`, `${stem}as`];
  if (base.endsWith('e')) return [base, `${base}s`];
  if (base.endsWith('i')) return [base, `${base}es`, `${base}s`];
  if (/(es|an|ol|on)$/.test(base)) return [base, `${base}a`, `${base}es`, `${base}as`];
  return [base];
}

interface CountryTerm {
  term: string;
  iso: string;
}

function buildCountryTerms(): CountryTerm[] {
  const terms: CountryTerm[] = [];
  const add = (iso: string, term: string) => terms.push({ iso, term: normalizeText(term) });

  for (const country of COUNTRIES_ES) {
    add(country.iso, country.name);
    demonymForms(country.demonym).forEach((form) => add(country.iso, form));
    (COUNTRY_ALIASES[country.iso] ?? []).forEach((alias) => add(country.iso, alias));
  }
  for (const location of LOCATIONS) add(location.countryIso, location.city);

  // Longest first so "ciudad de guatemala" or "el salvador" win over shorter overlaps.
  return terms.sort((left, right) => right.term.length - left.term.length);
}

const COUNTRY_TERMS = buildCountryTerms();

/**
 * Words that carry no topic: greetings, request verbs, time words and the intent phrases
 * themselves. A message made only of these (plus the reader's own place) is generic.
 */
const FILLER_WORDS = new Set(
  (
    'a al algo ahora aca aqui area cerca ciudad con cual cuales cuenta cuentame da dame de del ' +
    'dia dias dime donde el en es esta estan este esto favor ha hay hoy importante importantes ' +
    'la las lo local locales localidad los mas me mi mis momento muestrame nuevo nuevas nuevos ' +
    'noticia noticias novedades pais paso pasado pasando pasa por principales pon ponerme ponme ' +
    'que quiero region resume resumeme resumen resumes resumir saber se semana son su sucede ' +
    'sucedido tengo titulares todo ultima ultimas ultimo ultimos un una ver vivo y zona horas'
  ).split(' '),
);

/** True when, besides filler words and the reader's own place, the message names nothing. */
export function isGenericRequest(message: string, ownCountry?: string): boolean {
  const ownTerms = COUNTRY_TERMS.filter(({ iso }) => iso === ownCountry).flatMap(({ term }) =>
    term.split(' '),
  );
  return normalizeText(message)
    .split(' ')
    .filter(Boolean)
    .every((word) => FILLER_WORDS.has(word) || ownTerms.includes(word));
}

function containsPhrase(normalized: string, phrase: string): boolean {
  return ` ${normalized} `.includes(` ${phrase} `);
}

/** ISO codes of every catalog country or city named in the message, in order of appearance. */
export function detectCountries(message: string): string[] {
  let remaining = ` ${normalizeText(message)} `;
  COUNTRY_FALSE_FRIENDS.forEach((phrase) => {
    remaining = remaining.replaceAll(` ${phrase} `, ' ');
  });

  const found: { iso: string; position: number }[] = [];
  for (const { term, iso } of COUNTRY_TERMS) {
    const needle = ` ${term} `;
    let position = remaining.indexOf(needle);
    while (position !== -1) {
      found.push({ iso, position });
      // Blank the match so a shorter term inside it ("guatemala" in "ciudad de guatemala") is not
      // counted twice; keep one space on each side so the next word can still match.
      remaining = `${remaining.slice(0, position + 1)}${'_'.repeat(term.length)}${remaining.slice(position + 1 + term.length)}`;
      position = remaining.indexOf(needle);
    }
  }

  return [
    ...new Set(found.sort((left, right) => left.position - right.position).map(({ iso }) => iso)),
  ];
}

/**
 * Routes a chat message. Another country beats every other rule, so "Explícame lo más importante
 * de Argentina" is `otro_pais` and not `resumen`; naming the reader's own country counts as
 * `mi_region`.
 */
export function classifyIntent(message: string, locationId: string): IntentResult {
  const normalized = normalizeText(message);
  const ownCountry = findLocation(locationId)?.countryIso;
  const named = detectCountries(message);
  const others = named.filter((iso) => iso !== ownCountry);

  if (others.length > 0) return { intent: 'otro_pais', countries: others, generic: false };
  const generic = isGenericRequest(message, ownCountry);

  const mentionsOwnCountry = ownCountry !== undefined && named.includes(ownCountry);
  if (mentionsOwnCountry || REGION_PHRASES.some((phrase) => containsPhrase(normalized, phrase))) {
    return { intent: 'mi_region', countries: [], generic };
  }

  if (SUMMARY_PHRASES.some((phrase) => containsPhrase(normalized, phrase))) {
    return { intent: 'resumen', countries: [], generic };
  }

  return { intent: 'tema', countries: [], generic: false };
}
