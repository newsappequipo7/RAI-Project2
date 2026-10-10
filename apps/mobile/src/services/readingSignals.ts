import { updateInterests, userEventSchema, userProfileSchema, type News } from '@repo/shared';
import { collection, doc, runTransaction, setDoc, type Firestore } from 'firebase/firestore';

const MIN_DWELL_SECONDS = 20;
const MAX_READ_NEWS = 200;

/** Records the open immediately, then commits all interest changes once on leaving the story. */
export function startReadingSession(
  db: Firestore,
  uid: string,
  news: Pick<News, 'id' | 'topics'>,
  locationId: string,
  startedAt = new Date(),
) {
  const profileRef = doc(db, 'users', uid);
  const openRef = doc(collection(profileRef, 'events'));
  const openEvent = userEventSchema.parse({
    type: 'open',
    newsId: news.id,
    topic: news.topics[0],
    locationId,
    at: startedAt.toISOString(),
  });
  let openError: unknown;
  const openWrite = setDoc(openRef, openEvent).catch((error: unknown) => {
    openError = error;
  });
  let finished = false;

  return {
    async waitForOpen(): Promise<void> {
      await openWrite;
      if (openError) throw openError;
    },
    async finish(endedAt = new Date()): Promise<void> {
      if (finished) return;
      finished = true;
      await openWrite;
      if (openError) throw openError;
      const seconds = Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000));
      const dwellRef = seconds >= MIN_DWELL_SECONDS ? doc(collection(profileRef, 'events')) : null;

      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(profileRef);
        if (!snapshot.exists()) throw new Error('El perfil ya no está disponible.');
        const profile = userProfileSchema.parse(snapshot.data());
        if (profile.uid !== uid) throw new Error('El perfil no corresponde a la sesión.');
        const now = new Date(Math.max(endedAt.getTime(), Date.parse(profile.updatedAt)));
        let next = updateInterests({ profile, signal: { type: 'open', topics: news.topics }, now });
        if (dwellRef) {
          next = updateInterests({
            profile: next,
            signal: { type: 'dwell', topics: news.topics, seconds },
            now,
          });
        }
        const readNewsIds = [...new Set([news.id, ...profile.readNewsIds])].slice(0, MAX_READ_NEWS);
        transaction.update(profileRef, {
          interests: next.interests,
          mutedTopics: next.mutedTopics,
          interestsDecayedAt: next.interestsDecayedAt,
          readNewsIds,
          updatedAt: now.toISOString(),
        });
        if (dwellRef) {
          transaction.set(
            dwellRef,
            userEventSchema.parse({
              type: 'dwell',
              newsId: news.id,
              topic: news.topics[0],
              seconds,
              locationId,
              at: now.toISOString(),
            }),
          );
        }
      });
    },
  };
}
