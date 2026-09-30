import { describe, expect, it } from 'vitest';
import { findLocation } from './catalogs';
import { createDefaultProfile } from './profile';
import { userProfileSchema } from './schemas';

describe('createDefaultProfile', () => {
  const profile = createDefaultProfile(
    'uid-1',
    'Ana',
    'gt-guatemala',
    new Date('2026-09-30T00:00:00.000Z'),
  );

  it('produces a schema-valid profile', () => {
    expect(userProfileSchema.safeParse(profile).success).toBe(true);
  });

  it('starts personalized with no interests, mutes or reads', () => {
    expect(profile).toMatchObject({
      personalization: true,
      interests: {},
      mutedTopics: [],
      readNewsIds: [],
      updatedAt: '2026-09-30T00:00:00.000Z',
    });
  });

  it('keeps a catalog location', () => {
    expect(findLocation(profile.locationId)).toBeDefined();
  });
});
