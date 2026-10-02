import { findCountry } from '../catalogs/countries-es';
import { findLocation, REGIONS } from '../catalogs/locations';
import { findTopic } from '../catalogs/topics';
import type { News } from '../types';

export const TITLE_WARN_LENGTH = 110;
export const LEAD_MAX_LENGTH = 280;
export const MIN_TOPICS = 1;
export const MAX_TOPICS = 3;

export type NewsFieldName = 'title' | 'lead' | 'body' | 'topics' | 'geo' | 'importance';

export type EditableNewsFields = Pick<News, NewsFieldName>;

export interface FieldIssue {
  field: NewsFieldName;
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

function error(field: NewsFieldName, code: string, message: string): FieldIssue {
  return { field, code, message, severity: 'error' };
}

/** Field-level checks for the editor's Content and Classification sections. */
export function validateNewsFields(news: EditableNewsFields): FieldIssue[] {
  const issues: FieldIssue[] = [];
  const title = news.title.trim();
  const lead = news.lead.trim();

  if (title === '') {
    issues.push(error('title', 'title_required', 'El título es obligatorio.'));
  } else if (title.length > TITLE_WARN_LENGTH) {
    issues.push({
      field: 'title',
      code: 'title_long',
      message: `El título tiene ${title.length} caracteres; conviene que no pase de ${TITLE_WARN_LENGTH}.`,
      severity: 'warning',
    });
  }

  if (lead === '') {
    issues.push(error('lead', 'lead_required', 'La entradilla es obligatoria.'));
  } else if (lead.length > LEAD_MAX_LENGTH) {
    issues.push(
      error('lead', 'lead_too_long', `La entradilla no puede pasar de ${LEAD_MAX_LENGTH} caracteres.`),
    );
  }

  if (news.body.trim() === '') {
    issues.push(error('body', 'body_required', 'El cuerpo es obligatorio.'));
  }

  issues.push(...validateTopics(news.topics));
  issues.push(...validateGeo(news.geo));

  if (![0, 1, 2, 3].includes(news.importance)) {
    issues.push(error('importance', 'importance_invalid', 'La importancia debe ser 0, 1, 2 o 3.'));
  }

  return issues;
}

function validateTopics(topics: string[]): FieldIssue[] {
  const issues: FieldIssue[] = [];

  if (topics.length < MIN_TOPICS || topics.length > MAX_TOPICS) {
    issues.push(
      error('topics', 'topics_count', `Elige entre ${MIN_TOPICS} y ${MAX_TOPICS} temas del catálogo.`),
    );
  }
  if (new Set(topics).size !== topics.length) {
    issues.push(error('topics', 'topics_duplicated', 'Hay temas repetidos.'));
  }
  const unknown = topics.filter((key) => !findTopic(key));
  if (unknown.length > 0) {
    issues.push(error('topics', 'topics_unknown', `Temas fuera del catálogo: ${unknown.join(', ')}.`));
  }

  return issues;
}

function validateGeo(geo: News['geo']): FieldIssue[] {
  const issues: FieldIssue[] = [];

  if (geo.scope === 'global') {
    if (geo.countries.length + geo.cityIds.length + geo.regions.length > 0) {
      issues.push(
        error('geo', 'geo_global_scoped', 'Una noticia global no lleva países, ciudades ni regiones.'),
      );
    }
    return issues;
  }

  if (geo.countries.length === 0) {
    issues.push(error('geo', 'geo_countries_required', 'Elige al menos un país afectado.'));
  }
  const unknownCountries = geo.countries.filter((iso) => !findCountry(iso));
  if (unknownCountries.length > 0) {
    issues.push(
      error('geo', 'geo_country_unknown', `Países fuera del catálogo: ${unknownCountries.join(', ')}.`),
    );
  }

  const unknownRegions = geo.regions.filter((region) => !(REGIONS as string[]).includes(region));
  if (unknownRegions.length > 0) {
    issues.push(
      error('geo', 'geo_region_unknown', `Regiones fuera del catálogo: ${unknownRegions.join(', ')}.`),
    );
  }

  if (geo.scope === 'local') {
    if (geo.cityIds.length === 0) {
      issues.push(error('geo', 'geo_city_required', 'Una noticia local necesita al menos una ciudad.'));
    }
  } else if (geo.cityIds.length > 0) {
    issues.push(error('geo', 'geo_city_not_local', 'Solo las noticias locales llevan ciudades.'));
  }
  const unknownCities = geo.cityIds.filter((id) => !findLocation(id));
  if (unknownCities.length > 0) {
    issues.push(
      error('geo', 'geo_city_unknown', `Ciudades fuera del catálogo: ${unknownCities.join(', ')}.`),
    );
  }

  return issues;
}

export function hasErrors(issues: FieldIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'error');
}

/**
 * Invalid data must never be stored as published (F2-02 CA2). Drafts may be saved incomplete so that
 * autosave works; a published news must pass every field rule.
 */
export function saveBlockers(news: News): FieldIssue[] {
  if (news.workflow !== 'publicada') return [];
  return validateNewsFields(news).filter((issue) => issue.severity === 'error');
}
