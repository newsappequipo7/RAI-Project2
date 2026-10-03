import { describe, expect, it } from 'vitest';
import { TOPICS } from '../catalogs/topics';
import type { NewsGeo } from '../types';
import {
  buildCoverSpec,
  contrastRatio,
  COVER_CAPTION,
  COVER_LAYOUT,
  COVER_NEUTRAL_COLOR,
  readableTextColor,
} from './spec';

const national: NewsGeo = { scope: 'nacional', countries: ['GT'], cityIds: [], regions: [] };

describe('contrastRatio', () => {
  it('matches the WCAG extremes', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });
});

describe('buildCoverSpec', () => {
  it('is deterministic: the same news always gets the same cover', () => {
    const input = {
      title: 'Sismo sacude el occidente',
      topics: ['clima-desastres'],
      geo: national,
    };
    expect(buildCoverSpec(input)).toEqual(buildCoverSpec({ ...input }));
  });

  it('uses the main topic color and label, and the fixed caption', () => {
    const spec = buildCoverSpec({ title: 'Titular', topics: ['salud', 'economia'], geo: national });
    expect(spec.background).toBe(TOPICS.find((topic) => topic.key === 'salud')?.color);
    expect(spec.kicker).toBe('SALUD');
    expect(spec.caption).toBe(COVER_CAPTION);
  });

  it('falls back to a neutral color when there is no known topic', () => {
    const spec = buildCoverSpec({ title: 'Titular', topics: ['astrologia'], geo: national });
    expect(spec.background).toBe(COVER_NEUTRAL_COLOR);
    expect(spec.kicker).toBeNull();
  });

  it('keeps the title readable on every topic color (WCAG AA for large text, 3:1)', () => {
    for (const topic of TOPICS) {
      const spec = buildCoverSpec({ title: 'Titular', topics: [topic.key], geo: national });
      expect(contrastRatio(spec.background, spec.foreground), topic.key).toBeGreaterThanOrEqual(3);
    }
    expect(readableTextColor('#F39C12')).toBe('#111111');
    expect(readableTextColor('#2C3E50')).toBe('#FFFFFF');
  });

  it('shortens long titles at a word boundary and collapses whitespace', () => {
    const long = 'palabra '.repeat(30);
    const spec = buildCoverSpec({ title: `  ${long}  `, topics: [], geo: national });
    expect(spec.title.length).toBeLessThanOrEqual(COVER_LAYOUT.titleMaxChars);
    expect(spec.title.endsWith('…')).toBe(true);
    expect(buildCoverSpec({ title: 'a   b', topics: [], geo: national }).title).toBe('a b');
  });

  it('labels the place from cities, countries or scope', () => {
    const place = (geo: NewsGeo) => buildCoverSpec({ title: 't', topics: [], geo }).place;

    expect(place(national)).toBe('Guatemala');
    expect(place({ scope: 'global', countries: [], cityIds: [], regions: [] })).toBe('Global');
    expect(
      place({ scope: 'local', countries: ['GT'], cityIds: ['gt-quetzaltenango'], regions: [] }),
    ).toBe('Quetzaltenango');
    expect(
      place({ scope: 'regional', countries: ['GT', 'SV', 'HN', 'NI'], cityIds: [], regions: [] }),
    ).toBe('Guatemala · El Salvador y 2 más');
    expect(place({ scope: 'nacional', countries: [], cityIds: [], regions: [] })).toBeNull();
  });
});
