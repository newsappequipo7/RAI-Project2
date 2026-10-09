import { describe, expect, it } from 'vitest';
import { LOCATIONS } from '../catalogs/locations';
import { createDefaultProfile } from '../profile';
import { DEFAULT_RANKING_WEIGHTS, resolvePublicFeedConfig } from '../config/feed';
import { rankingWeightsSchema } from '../schemas';
import type { NewsGeo } from '../types';
import { affinity } from './affinity';
import { proximity } from './proximity';
import { recency } from './recency';
import { normalizeWeights } from './score';

const now = new Date('2026-10-09T12:00:00.000Z');
const profile = createDefaultProfile('test', 'Prueba', 'gt-guatemala', now);
const geo: NewsGeo = { scope: 'nacional', countries: [], cityIds: [], regions: [] };

describe('ranking components', () => {
  it.each<[Partial<NewsGeo>, number]>([
    [{ scope: 'local', cityIds: ['gt-guatemala'], countries: ['GT'] }, 1],
    [
      {
        scope: 'local',
        cityIds: ['gt-quetzaltenango'],
        countries: ['GT'],
        regions: ['centroamerica'],
      },
      0.45,
    ],
    [{ scope: 'global', countries: ['GT'], regions: ['centroamerica'] }, 0.6],
    [{ countries: ['GT'], regions: ['centroamerica'] }, 0.75],
    [{ countries: ['SV'], regions: ['centroamerica'] }, 0.4],
    [{ scope: 'internacional', countries: ['JP'] }, 0.2],
    [{ countries: ['JP'] }, 0.1],
  ])('applies the first matching proximity condition: %j', (patch, expected) => {
    expect(proximity({ ...geo, ...patch }, LOCATIONS[0]!)).toBe(expected);
  });

  it('uses neutral affinity, averages topics, and applies any muted topic first', () => {
    expect(affinity(['salud'], profile)).toBe(0.3);
    const interested = { ...profile, interests: { salud: 10, ciencia: 4 } };
    expect(affinity(['salud', 'ciencia'], interested)).toBe(0.7);
    expect(affinity(['salud', 'economia'], interested)).toBe(0.5);
    expect(affinity(['salud', 'ciencia'], { ...interested, mutedTopics: ['ciencia'] })).toBe(0);
    expect(
      affinity(['salud'], { ...interested, personalization: false, mutedTopics: ['salud'] }),
    ).toBe(0.3);
  });

  it('bounds malformed legacy interests and handles missing topics', () => {
    expect(affinity([], profile)).toBe(0.3);
    expect(affinity(['salud'], { ...profile, interests: { salud: 100 } })).toBe(1);
    expect(affinity(['salud'], { ...profile, interests: { salud: -10 } })).toBe(0);
    expect(affinity(['salud'], { ...profile, interests: { salud: NaN } })).toBe(0);
  });

  it.each([0, 1, 2, 3])('uses the half-life for importance %i', (importance) => {
    const halfLife = importance >= 2 ? 24 : 18;
    expect(recency(now.toISOString(), importance, now)).toBe(1);
    expect(recency(new Date(+now - halfLife * 3_600_000).toISOString(), importance, now)).toBe(0.5);
  });

  it('normalizes custom weights and redistributes affinity proportionally when disabled', () => {
    const w = normalizeWeights(DEFAULT_RANKING_WEIGHTS, false);
    expect(w.wA).toBe(0);
    expect(w.wI).toBeCloseTo(0.35 / 0.8);
    expect(w.wG / w.wR).toBeCloseTo(2);
    expect(normalizeWeights({ wI: 1, wG: 1, wA: 1, wR: 1 }, true)).toEqual({
      wI: 0.25,
      wG: 0.25,
      wA: 0.25,
      wR: 0.25,
    });
  });
});

describe('public feed configuration', () => {
  it.each([undefined, null, {}, 'invalid'])(
    'falls back when config/public is missing or malformed: %j',
    (value) => {
      expect(resolvePublicFeedConfig(value)).toEqual({
        feedWindowHours: 72,
        rankingWeights: DEFAULT_RANKING_WEIGHTS,
        demoMode: false,
      });
    },
  );

  it('validates each field independently and does not share mutable defaults', () => {
    const config = resolvePublicFeedConfig({
      feedWindowHours: 168,
      rankingWeights: { wI: -1 },
      demoMode: true,
    });
    expect(config).toEqual({
      feedWindowHours: 168,
      rankingWeights: DEFAULT_RANKING_WEIGHTS,
      demoMode: true,
    });
    config.rankingWeights.wI = 0;
    expect(resolvePublicFeedConfig(undefined).rankingWeights.wI).toBe(0.35);
    expect(resolvePublicFeedConfig({ feedWindowHours: -1 }).feedWindowHours).toBe(72);
    const weights = { wI: 1, wG: 0, wA: 0, wR: 0 };
    expect(resolvePublicFeedConfig({ rankingWeights: weights }).rankingWeights).toEqual(weights);
  });

  it.each([
    { wI: 0, wG: 0, wA: 0, wR: 0 },
    { wI: 0, wG: 0, wA: 1, wR: 0 },
    { ...DEFAULT_RANKING_WEIGHTS, wI: -1 },
    { ...DEFAULT_RANKING_WEIGHTS, wI: NaN },
    { ...DEFAULT_RANKING_WEIGHTS, wI: Infinity },
    { ...DEFAULT_RANKING_WEIGHTS, wI: 2 },
  ])('rejects unusable weights: %j', (weights) => {
    expect(rankingWeightsSchema.safeParse(weights).success).toBe(false);
  });
});
