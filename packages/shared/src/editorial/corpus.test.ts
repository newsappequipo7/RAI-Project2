import { describe, expect, it } from 'vitest';
import demoJson from '../../fixtures/demo-drafts.json';
import corpusJson from '../../fixtures/editorial-corpus.json';
import seedJson from '../../fixtures/news.json';
import { LOCATIONS } from '../catalogs/locations';
import { newsSchema } from '../schemas';
import { buildSeedNews, type SeedNews } from '../seed';
import type { News } from '../types';
import { buildEditorialDrafts, type CorpusItem } from './corpus';
import { buildCoverImage } from './images';
import { isValidSourceUrl } from './sources';
import { validatePublish } from './validatePublish';

const NOW = new Date('2026-10-02T18:00:00.000Z');
const REAL = corpusJson as unknown as CorpusItem[];
const DEMO = demoJson as unknown as CorpusItem[];
const realDrafts = buildEditorialDrafts(REAL, 'editorial-corpus', NOW);
const demoDrafts = buildEditorialDrafts(DEMO, 'editorial-corpus', NOW);

/** What the editor does by hand before publishing: open each link and tick the checklist. */
function attested(news: News): News {
  return {
    ...news,
    checklist: Object.fromEntries(
      Object.keys(news.checklist).map((item) => [item, true]),
    ) as News['checklist'],
    image: news.image ?? buildCoverImage(news.title),
  };
}

describe('real editorial corpus (F2-11)', () => {
  it('has at least 15 news, each valid for the News schema, with unique ids', () => {
    expect(realDrafts.length).toBeGreaterThanOrEqual(15);
    expect(new Set(realDrafts.map((item) => item.id)).size).toBe(realDrafts.length);
    for (const item of realDrafts) expect(newsSchema.safeParse(item).success, item.id).toBe(true);
  });

  it('spreads the news across all 8 catalog locations', () => {
    const covered = new Set(REAL.map((item) => item.locationId));
    for (const location of LOCATIONS) expect(covered.has(location.id), location.id).toBe(true);
  });

  it('keeps each geography consistent with its location (local cities, national countries)', () => {
    for (const item of REAL) {
      const location = LOCATIONS.find((candidate) => candidate.id === item.locationId);
      expect(location, item.id).toBeDefined();
      expect(item.geo.countries, item.id).toContain(location?.countryIso);
      if (item.geo.scope === 'local') expect(item.geo.cityIds, item.id).toContain(item.locationId);
    }
  });

  it('CA2: every news passes validatePublish once the editor completes the checklist', () => {
    for (const draft of realDrafts) {
      const result = validatePublish(attested(draft), draft.certainty);
      expect(
        result.errors.map((error) => error.code),
        draft.id,
      ).toEqual([]);
    }
  });

  it('pre-selects the generated cover, so no image is left for the editor', () => {
    expect(realDrafts.every((draft) => draft.image?.kind === 'portada_generada')).toBe(true);
  });

  it('is never publishable by itself: the only blockers are the human checklist items', () => {
    for (const draft of realDrafts) {
      const result = validatePublish(draft, draft.certainty);
      expect(result.ok, draft.id).toBe(false);
      expect(
        result.errors.every((error) => error.field === 'checklist'),
        `${draft.id}: ${result.errors.map((error) => error.code).join(', ')}`,
      ).toBe(true);
    }
  });

  it('uses only real, distinct source links (no placeholders)', () => {
    for (const item of REAL) {
      const urls = item.sources.map((source) => source.url);
      expect(new Set(urls).size, item.id).toBe(urls.length);
      for (const url of urls) {
        expect(isValidSourceUrl(url), `${item.id} ${url}`).toBe(true);
        expect(url.startsWith('https://'), `${item.id} ${url}`).toBe(true);
        expect(url, item.id).not.toMatch(/example\.(org|com)/);
      }
    }
  });

  it('never marks a claim as backed on its own, and links claims only to existing sources', () => {
    for (const item of REAL) {
      const keys = new Set(item.sources.map((source) => source.key));
      for (const claim of item.claims) {
        expect(claim.sources.length, `${item.id}: ${claim.text}`).toBeGreaterThan(0);
        for (const key of claim.sources) expect(keys.has(key), `${item.id} ${key}`).toBe(true);
      }
    }
  });

  it('gives each news an editor review note, and keeps titles within the recommended length', () => {
    for (const item of REAL) {
      expect(item.review.trim().length, item.id).toBeGreaterThan(20);
      expect(item.title.length, item.id).toBeLessThanOrEqual(110);
      expect(item.lead.length, item.id).toBeLessThanOrEqual(280);
    }
  });

  it('proposes confirmada only where the rules allow it, and says what is missing otherwise', () => {
    for (const draft of realDrafts) {
      if (draft.certainty === 'en_desarrollo') expect(draft.certaintyNote, draft.id).toBeTruthy();
    }
    expect(realDrafts.some((draft) => draft.certainty === 'confirmada')).toBe(true);
    expect(realDrafts.some((draft) => draft.certainty === 'en_desarrollo')).toBe(true);
  });

  it('together with the 40 seed news there are at least 55 publishable news (CA1)', () => {
    const seed = buildSeedNews(seedJson as SeedNews[], NOW);
    expect(seed.length + realDrafts.length).toBeGreaterThanOrEqual(55);
    for (const item of seed) {
      expect(validatePublish({ ...item, workflow: 'publicada' }, item.certainty).ok, item.id).toBe(
        true,
      );
    }
  });
});

describe('demo drafts (DEMO-RUNBOOK §2)', () => {
  const [d1, d2] = demoDrafts as [News, News];

  it('D1: local, essential, en_desarrollo with a note and its source already loaded', () => {
    expect(d1).toMatchObject({ id: 'demo-d1', certainty: 'en_desarrollo', importance: 3 });
    expect(d1.geo).toMatchObject({ scope: 'local', cityIds: ['gt-quetzaltenango'] });
    expect(d1.certaintyNote).toBeTruthy();
    expect(d1.sources).toHaveLength(1);
    expect(validatePublish(attested(d1), d1.certainty).ok).toBe(true);
  });

  it('D2: international, routine, confirmada, with no image so the cover is chosen live', () => {
    expect(d2).toMatchObject({ id: 'demo-d2', certainty: 'confirmada', importance: 0 });
    expect(d2.geo.scope).toBe('internacional');
    expect(d2.image).toBeUndefined();
    const result = validatePublish({ ...d2, checklist: attested(d2).checklist }, d2.certainty);
    expect(result.errors.map((error) => error.code)).toEqual(['image_required']);
    expect(validatePublish(attested(d2), d2.certainty).ok).toBe(true);
  });

  it('are clearly marked as tests and use placeholder sources, like the seed corpus', () => {
    for (const draft of demoDrafts) {
      expect(draft.body).toContain('Noticia de prueba para el proyecto académico');
      expect(draft.sources.every((source) => source.url.includes('example.org'))).toBe(true);
    }
  });
});
