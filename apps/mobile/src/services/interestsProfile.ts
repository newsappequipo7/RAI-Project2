import { updateInterests, userProfileSchema, type UserProfile } from '@repo/shared';
import { doc, runTransaction, type Firestore } from 'firebase/firestore';

type ProfileAction = { type: 'reset' } | { type: 'unmute'; topic: string };

/** Profile controls read the latest document so they cannot replace a concurrent reading signal. */
export async function changeInterestProfile(
  db: Firestore,
  uid: string,
  action: ProfileAction | { type: 'personalization'; enabled: boolean } | { type: 'decay' },
  requestedAt = new Date(),
): Promise<UserProfile> {
  const profileRef = doc(db, 'users', uid);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(profileRef);
    if (!snapshot.exists()) throw new Error('El perfil ya no está disponible.');
    const profile = userProfileSchema.parse(snapshot.data());
    if (profile.uid !== uid) throw new Error('El perfil no corresponde a la sesión.');
    const now = new Date(Math.max(requestedAt.getTime(), Date.parse(profile.updatedAt)));
    const next = updateInterests({
      profile,
      signal: action.type === 'reset' || action.type === 'unmute' ? action : undefined,
      now,
    });
    const personalization =
      action.type === 'personalization' ? action.enabled : profile.personalization;
    if (next !== profile || personalization !== profile.personalization) {
      transaction.update(profileRef, {
        interests: next.interests,
        mutedTopics: next.mutedTopics,
        interestsDecayedAt: next.interestsDecayedAt,
        personalization,
        updatedAt: now.toISOString(),
      });
    }
    return { ...next, personalization };
  });
}
