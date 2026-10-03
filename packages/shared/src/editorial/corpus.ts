import type { Certainty, News, NewsGeo, Source } from '../types';
import { buildCoverImage } from './images';
import { buildSource, createClaim } from './sources';

/** A source as written in the corpus files; `key` links the claims to it. */
export interface CorpusSource extends Omit<Source, 'id' | 'accessedAt'> {
  key: string;
}

export interface CorpusClaim {
  text: string;
  /** Keys of the sources that back the claim. */
  sources: string[];
}

/**
 * One news of the editorial corpus (F2-11). The text is the team's own rewrite; the facts come only
 * from the linked sources, and `review` tells the editor what to check before publishing.
 */
export interface CorpusItem {
  id: string;
  locationId: string;
  title: string;
  lead: string;
  body: string;
  topics: string[];
  geo: NewsGeo;
  importance: 0 | 1 | 2 | 3;
  certainty: Certainty;
  certaintyNote?: string;
  sources: CorpusSource[];
  claims: CorpusClaim[];
  /** `cover` pre-selects the generated cover; omitted or `null` leaves the image for the editor. */
  image?: 'cover' | null;
  review: string;
}

/**
 * Turns a corpus item into a draft. It is never published here: the checklist stays unchecked, so
 * `validatePublish` blocks it until a person opens the links, checks each box and publishes.
 */
export function buildEditorialDraft(item: CorpusItem, createdBy: string, now: Date): News {
  const timestamp = now.toISOString();
  const sources = item.sources.map(({ key, ...source }) =>
    buildSource({ ...source, id: `${item.id}:${key}`, accessedAt: timestamp }),
  );
  const idOf = (key: string) => {
    const found = sources.find((source) => source.id === `${item.id}:${key}`);
    if (!found) throw new Error(`Claim of ${item.id} points to unknown source key "${key}"`);
    return found.id;
  };

  return {
    id: item.id,
    title: item.title,
    lead: item.lead,
    body: item.body,
    bodyOrigin: 'original_editorial',
    topics: [...item.topics],
    geo: {
      ...item.geo,
      countries: [...item.geo.countries],
      cityIds: [...item.geo.cityIds],
      regions: [...item.geo.regions],
    },
    importance: item.importance,
    certainty: item.certainty,
    ...(item.certaintyNote ? { certaintyNote: item.certaintyNote } : {}),
    sources,
    claims: item.claims.map((claim, index) =>
      createClaim(`${item.id}:claim-${index + 1}`, claim.text, claim.sources.map(idOf), sources),
    ),
    ...(item.image === 'cover' ? { image: buildCoverImage(item.title) } : {}),
    workflow: 'borrador',
    checklist: {
      fuentes_revisadas: false,
      afirmaciones_con_respaldo: false,
      titulo_no_sensacionalista: false,
      imagen_etiquetada: false,
      alcance_geo_revisado: false,
      certeza_justificada: false,
    },
    corrections: [],
    version: 0,
    createdBy,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function buildEditorialDrafts(items: CorpusItem[], createdBy: string, now: Date): News[] {
  return items.map((item) => buildEditorialDraft(item, createdBy, now));
}
