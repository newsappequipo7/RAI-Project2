import type { UserProfile } from './types';

export const DEFAULT_PERSONALIZATION = true;

export function createDefaultProfile(
  uid: string,
  displayName: string,
  locationId: string,
  now: Date = new Date(),
): UserProfile {
  return {
    uid,
    displayName,
    locationId,
    interests: {},
    mutedTopics: [],
    personalization: DEFAULT_PERSONALIZATION,
    readNewsIds: [],
    updatedAt: now.toISOString(),
  };
}
