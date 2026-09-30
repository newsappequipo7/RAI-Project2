import { describe, expect, it } from 'vitest';
import seedJson from '../fixtures/news.json';
import { LOCATIONS, TOPICS } from './catalogs';
import { newsSchema } from './schemas';
import { buildSeedNews, toIndexInput, type SeedNews } from './seed';
import type { Certainty, News } from './types';

const NOW = new Date('2026-09-30T12:00:00.000Z');
const SEED = seedJson as SeedNews[];
const news = buildSeedNews(SEED, NOW);
const TEST_MARKER = 'Noticia de prueba para el proyecto académico';

function countBy<T>(items: T[], pick: (item: T) => string | number): Record<string, number> {
  return items.reduce<Record<string, number>>((counts, item) => {
    const key = String(pick(item));
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function confirmingSources(item: News) {
  return item.sources.filter((source) => source.supports === 'confirma');
}

describe('seed corpus', () => {
  it('has 40 valid news with unique ids', () => {
    expect(news).toHaveLength(40);
    expect(new Set(news.map((item) => item.id)).size).toBe(40);
    news.forEach((item) => expect(newsSchema.safeParse(item).success, item.id).toBe(true));
  });

  it('marks every body as test content', () => {
    news.forEach((item) => expect(item.body.endsWith(TEST_MARKER), item.id).toBe(true));
  });

  it('covers certainty, scope and importance quotas', () => {
    expect(countBy(news, (item) => item.certainty)).toEqual({
      confirmada: 26,
      en_desarrollo: 8,
      disputada: 3,
      retractada: 3,
    });
    expect(countBy(news, (item) => item.geo.scope)).toMatchObject({ internacional: 8, global: 3 });
    expect(countBy(news, (item) => item.importance)[3]).toBe(6);
    expect(countBy(news, (item) => item.importance)[2]).toBe(10);
  });

  it('places the essential news where the plan requires', () => {
    const essential = news.filter((item) => item.importance === 3);
    const inCountry = (iso: string) => essential.filter((item) => item.geo.countries.includes(iso));
    expect(inCountry('GT')).toHaveLength(2);
    expect(inCountry('MX')).toHaveLength(1);
    expect(inCountry('ES')).toHaveLength(1);
    expect(essential.filter((item) => item.geo.scope === 'global')).toHaveLength(2);
  });

  it('has at least two local or national news per catalog location', () => {
    for (const location of LOCATIONS) {
      const relevant = news.filter(
        (item) =>
          (item.geo.scope === 'local' && item.geo.cityIds.includes(location.id)) ||
          (item.geo.scope === 'nacional' && item.geo.countries.includes(location.countryIso)),
      );
      expect(relevant.length, location.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('represents every topic and only catalog topics', () => {
    const used = new Set(news.flatMap((item) => item.topics));
    TOPICS.forEach((topic) => expect(used.has(topic.key), topic.key).toBe(true));
    used.forEach((key) =>
      expect(
        TOPICS.some((topic) => topic.key === key),
        key,
      ).toBe(true),
    );
  });

  it('uses only real-licensed or generated images and never AI images', () => {
    const kinds = countBy(news, (item) => item.image?.kind ?? 'none');
    expect(kinds.licencia_libre).toBeGreaterThan(0);
    expect(kinds.portada_generada).toBeGreaterThan(0);
    expect(Object.keys(kinds).sort()).toEqual(['licencia_libre', 'portada_generada']);
  });

  it('keeps sources coherent with certainty (VERIFICACION-Y-FUENTES §2)', () => {
    const rules: Record<Certainty, (item: News) => boolean> = {
      confirmada: (item) => {
        const confirming = confirmingSources(item).filter((source) => source.type !== 'redes');
        const organizations = new Set(confirming.map((source) => source.organization));
        const solid = confirming.some(
          (source) => source.type === 'primaria' || source.type === 'agencia',
        );
        return (
          organizations.size >= 2 &&
          solid &&
          item.claims.every((claim) => claim.status === 'respaldada')
        );
      },
      en_desarrollo: (item) => confirmingSources(item).length >= 1 && Boolean(item.certaintyNote),
      disputada: (item) =>
        confirmingSources(item).length >= 1 &&
        item.sources.some((source) => source.supports === 'contradice') &&
        Boolean(item.certaintyNote),
      retractada: (item) => item.corrections.some((entry) => entry.kind === 'retractacion'),
    };

    news.forEach((item) => expect(rules[item.certainty](item), item.id).toBe(true));
  });

  it('converts hours ago into ISO dates relative to now', () => {
    const sismo = news.find((item) => item.id === 'n-gt-sismo');
    expect(sismo?.publishedAt).toBe('2026-09-30T09:00:00.000Z');
  });

  it('builds index inputs that keep the certainty of retracted news', () => {
    const inputs = news.map(toIndexInput);
    expect(inputs.filter((input) => input.certainty === 'retractada')).toHaveLength(3);
    expect(inputs.every((input) => input.sources.length > 0)).toBe(true);
  });
});
