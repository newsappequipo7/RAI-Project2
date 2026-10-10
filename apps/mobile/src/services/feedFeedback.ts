import {
  updateInterests,
  userEventSchema,
  userProfileSchema,
  type News,
  type UserProfile,
} from '@repo/shared';
import { addDoc, collection, doc, runTransaction, type Firestore } from 'firebase/firestore';

export type FeedbackType = 'more_like_this' | 'less_like_this';

/** A transparency view is recorded even if the reader does not change their preferences. */
export async function recordWhyOpened(
  db: Firestore,
  uid: string,
  newsId: string,
  locationId: string,
  now = new Date(),
): Promise<void> {
  const event = userEventSchema.parse({
    type: 'why_opened',
    newsId,
    locationId,
    at: now.toISOString(),
  });
  await addDoc(collection(db, 'users', uid, 'events'), event);
}

/** Reads the latest profile so a feedback action never overwrites concurrent location/profile edits. */
export async function submitFeedFeedback(
  db: Firestore,
  uid: string,
  news: Pick<News, 'id' | 'topics'>,
  type: FeedbackType,
  requestedAt = new Date(),
): Promise<UserProfile> {
  const profileRef = doc(db, 'users', uid);
  const eventRef = doc(collection(profileRef, 'events'));
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(profileRef);
    if (!snapshot.exists()) throw new Error('El perfil ya no está disponible.');
    const profile = userProfileSchema.parse(snapshot.data());
    if (profile.uid !== uid) throw new Error('El perfil no corresponde a la sesión.');
    const now = new Date(Math.max(requestedAt.getTime(), Date.parse(profile.updatedAt)));
    const next = updateInterests({ profile, signal: { type, topics: news.topics }, now });
    const event = userEventSchema.parse({
      type,
      newsId: news.id,
      topic: news.topics[0],
      locationId: profile.locationId,
      at: now.toISOString(),
    });
    if (next !== profile) {
      transaction.update(profileRef, {
        interests: next.interests,
        mutedTopics: next.mutedTopics,
        interestsDecayedAt: next.interestsDecayedAt,
        updatedAt: next.updatedAt,
      });
    }
    transaction.set(eventRef, event);
    return next;
  });
}
