import { updateInterests, userEventSchema, userProfileSchema } from '@repo/shared';
import { collection, doc, runTransaction, type Firestore } from 'firebase/firestore';

/**
 * F4-04 step 6: the topic of a chat answer counts as a soft interest signal (`chat_topic`, +0.5).
 * Like other signals, it reads the latest profile so it never overwrites a concurrent change.
 */
export async function recordChatTopic(
  db: Firestore,
  uid: string,
  topic: string,
  requestedAt = new Date(),
): Promise<void> {
  const profileRef = doc(db, 'users', uid);
  const eventRef = doc(collection(profileRef, 'events'));
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(profileRef);
    if (!snapshot.exists()) throw new Error('El perfil ya no está disponible.');
    const profile = userProfileSchema.parse(snapshot.data());
    if (profile.uid !== uid) throw new Error('El perfil no corresponde a la sesión.');
    const now = new Date(Math.max(requestedAt.getTime(), Date.parse(profile.updatedAt)));
    const next = updateInterests({ profile, signal: { type: 'chat_topic', topic }, now });
    if (next !== profile) {
      transaction.update(profileRef, {
        interests: next.interests,
        mutedTopics: next.mutedTopics,
        interestsDecayedAt: next.interestsDecayedAt,
        updatedAt: next.updatedAt,
      });
    }
    transaction.set(
      eventRef,
      userEventSchema.parse({
        type: 'chat_topic',
        topic,
        locationId: profile.locationId,
        at: now.toISOString(),
      }),
    );
  });
}
