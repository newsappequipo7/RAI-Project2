import { describe, expect, it } from 'vitest';
import { createDefaultProfile } from '../profile';
import type { InterestSignal, UserProfile } from '../types';
import { updateInterests } from './update';
import { interestSignalSchema, updateInterestsInputSchema, userProfileSchema } from '../schemas';

const start = new Date('2026-10-09T12:00:00.000Z');
const hoursLater = (hours: number) => new Date(+start + hours * 3_600_000);
const makeProfile = (patch: Partial<UserProfile> = {}): UserProfile => ({
  ...createDefaultProfile('test', 'Prueba', 'gt-guatemala', start),
  interestsDecayedAt: start.toISOString(),
  ...patch,
});
const apply = (profile: UserProfile, signal?: InterestSignal, now = start) =>
  updateInterests({ profile, signal, now });

describe('interest signals', () => {
  it.each<[InterestSignal, number]>([
    [{ type: 'open', topics: ['deportes'] }, 0.5],
    [{ type: 'dwell', topics: ['deportes'], seconds: 20 }, 1],
    [{ type: 'dwell', topics: ['deportes'], seconds: 300 }, 1],
    [{ type: 'more_like_this', topics: ['deportes'] }, 2],
    [{ type: 'less_like_this', topics: ['deportes'] }, -3],
    [{ type: 'chat_topic', topic: 'deportes' }, 0.5],
  ])('applies %j', (signal, delta) => {
    const result = apply(makeProfile({ interests: { deportes: 4, salud: 7 } }), signal);
    expect(result.interests).toEqual({ deportes: 4 + delta, salud: 7 });
  });

  it('applies a delta once per distinct topic and initializes absent interests at zero', () => {
    const result = apply(makeProfile(), { type: 'open', topics: ['salud', 'deportes', 'salud'] });
    expect(result.interests).toEqual({ salud: 0.5, deportes: 0.5 });
  });

  it.each([0, 19, 19.999])('ignores dwell below twenty seconds: %s', (seconds) => {
    const profile = makeProfile({ interests: { deportes: 4 } });
    expect(apply(profile, { type: 'dwell', topics: ['deportes'], seconds }, hoursLater(1))).toEqual(
      profile,
    );
  });

  it('does not learn from opening the explanation panel', () => {
    const profile = makeProfile({ interests: { deportes: 4 } });
    expect(apply(profile, { type: 'why_opened' }, hoursLater(1))).toEqual(profile);
  });

  it('clamps both delta results and out-of-range legacy scores to [0,10]', () => {
    const result = apply(makeProfile({ interests: { deportes: 9.9, salud: -2, ciencia: 12 } }), {
      type: 'more_like_this',
      topics: ['deportes'],
    });
    expect(result.interests).toEqual({ deportes: 10, salud: 0, ciencia: 10 });
    expect(
      apply(makeProfile({ interests: { deportes: 1 } }), {
        type: 'less_like_this',
        topics: ['deportes'],
      }).interests.deportes,
    ).toBe(0);
  });

  it('adds a mute only when less-like-this reaches zero and never duplicates it', () => {
    const profile = makeProfile({ interests: { deportes: 4, salud: 3, cultura: 0 } });
    const result = apply(profile, {
      type: 'less_like_this',
      topics: ['deportes', 'salud', 'cultura', 'salud'],
    });
    expect(result.interests).toEqual({ deportes: 1, salud: 0, cultura: 0 });
    expect(result.mutedTopics).toEqual(['salud', 'cultura']);
    expect(apply(result, { type: 'less_like_this', topics: ['salud'] }).mutedTopics).toEqual([
      'salud',
      'cultura',
    ]);
  });

  it('passive signals preserve explicit mutes, while more-like-this reactivates the affected topic', () => {
    let profile = makeProfile({ interests: { salud: 0 }, mutedTopics: ['salud', 'politica'] });
    for (const signal of [
      { type: 'open', topics: ['salud'] },
      { type: 'dwell', topics: ['salud'], seconds: 25 },
      { type: 'chat_topic', topic: 'salud' },
    ] satisfies InterestSignal[])
      profile = apply(profile, signal);
    expect(profile.interests.salud).toBe(2);
    expect(profile.mutedTopics).toEqual(['salud', 'politica']);
    const result = apply(profile, { type: 'more_like_this', topics: ['salud'] });
    expect(result.interests.salud).toBe(4);
    expect(result.mutedTopics).toEqual(['politica']);
  });

  it('unmutes without inventing interests and resets interests/mutes without changing other profile fields', () => {
    const profile = makeProfile({
      interests: { salud: 5 },
      mutedTopics: ['salud'],
      readNewsIds: ['read'],
      personalization: false,
    });
    const unmuted = apply(profile, { type: 'unmute', topic: 'salud' });
    expect(unmuted.interests).toEqual({ salud: 5 });
    expect(unmuted.mutedTopics).toEqual([]);
    const reset = apply(profile, { type: 'reset' }, hoursLater(2));
    expect(reset).toEqual({
      ...profile,
      interests: {},
      mutedTopics: [],
      interestsDecayedAt: hoursLater(2).toISOString(),
      updatedAt: hoursLater(2).toISOString(),
    });
  });

  it('keeps the personalization switch as a ranking preference and returns deterministic results without mutation', () => {
    const profile = makeProfile({
      personalization: false,
      readNewsIds: ['old'],
      interests: { deportes: 1 },
    });
    const signal: InterestSignal = { type: 'open', topics: ['deportes'] };
    const before = JSON.stringify({ profile, signal });
    const result = apply(profile, signal, hoursLater(1));
    expect(result.interests.deportes).toBe(1.5);
    expect(result.personalization).toBe(false);
    expect(result.readNewsIds).toEqual(['old']);
    expect(result.updatedAt).toBe(hoursLater(1).toISOString());
    expect(apply(profile, signal, hoursLater(1))).toEqual(result);
    expect(JSON.stringify({ profile, signal })).toBe(before);
  });
});

describe('daily interest decay', () => {
  it('starts new profiles with an independent clock and accepts legacy profiles without it', () => {
    const profile = createDefaultProfile('new', 'Nueva', 'es-madrid', start);
    expect(profile.interestsDecayedAt).toBe(start.toISOString());
    expect(userProfileSchema.safeParse(profile).success).toBe(true);
    const legacy = { ...profile };
    delete legacy.interestsDecayedAt;
    expect(userProfileSchema.safeParse(legacy).success).toBe(true);
  });

  it('waits a full 24 hours, includes the boundary, and does not decay twice at the same time', () => {
    const profile = makeProfile({ interests: { deportes: 10 } });
    expect(apply(profile, undefined, new Date(+hoursLater(24) - 1)).interests.deportes).toBe(10);
    const result = apply(profile, undefined, hoursLater(24));
    expect(result.interests.deportes).toBe(9);
    expect(result.interestsDecayedAt).toBe(hoursLater(24).toISOString());
    expect(apply(result, undefined, hoursLater(24))).toEqual(result);
  });

  it('applies all complete days and retains the fractional day', () => {
    const profile = makeProfile({ interests: { deportes: 10 } });
    const result = apply(profile, undefined, hoursLater(84));
    expect(result.interests.deportes).toBeCloseTo(7.29);
    expect(result.interestsDecayedAt).toBe(hoursLater(72).toISOString());
    expect(apply(result, undefined, hoursLater(96)).interests.deportes).toBeCloseTo(6.561);
  });

  it('does not postpone decay when a signal or a location update changes updatedAt', () => {
    const original = makeProfile({ interests: { salud: 10 } });
    const read = apply(original, { type: 'open', topics: ['deportes'] }, hoursLater(12));
    const relocated = { ...read, locationId: 'es-madrid', updatedAt: hoursLater(20).toISOString() };
    const result = apply(relocated, undefined, hoursLater(24));
    expect(result.interests.salud).toBe(9);
    expect(result.interests.deportes).toBeCloseTo(0.45);
    expect(result.locationId).toBe('es-madrid');
  });

  it('decays before applying the new signal', () => {
    const result = apply(
      makeProfile({ interests: { deportes: 10 } }),
      { type: 'less_like_this', topics: ['deportes'] },
      hoursLater(24),
    );
    expect(result.interests.deportes).toBe(6);
  });

  it('preserves mutes during decay and never mutes a topic merely because its score is zero', () => {
    const result = apply(
      makeProfile({ interests: { salud: 0, deportes: 1 }, mutedTopics: ['politica'] }),
      undefined,
      hoursLater(48),
    );
    expect(result.interests.deportes).toBeCloseTo(0.81);
    expect(result.mutedTopics).toEqual(['politica']);
  });

  it('initializes legacy profiles from updatedAt once without mutating the old document', () => {
    const profile = makeProfile({ interests: { salud: 10 } });
    delete profile.interestsDecayedAt;
    const result = apply(profile, undefined, hoursLater(36));
    expect(result.interests.salud).toBe(9);
    expect(result.interestsDecayedAt).toBe(hoursLater(24).toISOString());
    expect(profile.interestsDecayedAt).toBeUndefined();
    expect(apply(result, undefined, hoursLater(48)).interests.salud).toBeCloseTo(8.1);
  });

  it('anchors a legacy profile before 24h without losing the already elapsed fraction', () => {
    const profile = makeProfile({ interests: { salud: 10 } });
    delete profile.interestsDecayedAt;
    const result = apply(profile, undefined, hoursLater(12));
    expect(result.interests.salud).toBe(10);
    expect(result.interestsDecayedAt).toBe(start.toISOString());
    expect(apply(result, undefined, hoursLater(24)).interests.salud).toBe(9);
  });

  it('keeps empty profiles finite over long gaps and makes same-time no-ops reusable', () => {
    const result = apply(makeProfile(), undefined, hoursLater(24000));
    expect(result.interests).toEqual({});
    expect(userProfileSchema.safeParse(result).success).toBe(true);
    expect(apply(result, undefined, hoursLater(24000))).toBe(result);
  });
});

describe('validation at the interest update boundary', () => {
  it.each([
    { type: 'open', topics: [] },
    { type: 'open', topics: ['inventado'] },
    { type: 'open', topics: ['salud'], seconds: 25 },
    { type: 'dwell', topics: ['salud'] },
    { type: 'dwell', topics: ['salud'], seconds: -1 },
    { type: 'dwell', topics: ['salud'], seconds: NaN },
    { type: 'dwell', topics: ['salud'], seconds: Infinity },
    { type: 'chat_topic', topic: 'inventado' },
    { type: 'chat_topic', topics: ['salud'] },
    { type: 'why_opened', topics: ['salud'] },
    { type: 'unmute', topic: 'inventado' },
    { type: 'unknown' },
  ])('rejects a malformed signal atomically: %j', (signal) => {
    const profile = makeProfile({ interests: { salud: 5 } });
    const before = JSON.stringify(profile);
    expect(interestSignalSchema.safeParse(signal).success).toBe(false);
    expect(() => apply(profile, signal as InterestSignal)).toThrow();
    expect(JSON.stringify(profile)).toBe(before);
  });

  it('rejects invalid dates, backwards updates and inconsistent decay clocks', () => {
    expect(() => apply(makeProfile(), undefined, new Date('invalid'))).toThrow();
    expect(() => apply(makeProfile({ updatedAt: 'invalid' }))).toThrow();
    expect(() => apply(makeProfile(), undefined, hoursLater(-1))).toThrow();
    expect(() => apply(makeProfile({ interestsDecayedAt: hoursLater(1).toISOString() }))).toThrow();
    expect(
      updateInterestsInputSchema.safeParse({ profile: makeProfile(), now: 'not-a-date' }).success,
    ).toBe(false);
  });

  it.each([NaN, Infinity, -Infinity])('rejects non-finite stored interests: %s', (value) => {
    expect(() => apply(makeProfile({ interests: { salud: value } }))).toThrow();
  });

  it('preserves finite legacy topic entries while refusing new signals outside the catalogue', () => {
    const result = apply(makeProfile({ interests: { 'old-topic': 5 } }), {
      type: 'open',
      topics: ['salud'],
    });
    expect(result.interests).toEqual({ 'old-topic': 5, salud: 0.5 });
  });
});
