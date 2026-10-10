import { newsSchema, type News } from '@repo/shared';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';

interface NewsDetailObserver {
  news: (news: News | null) => void;
  versions: (versions: News[]) => void;
  error: (error: Error) => void;
  versionsError: (error: Error) => void;
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error('No se pudo leer la noticia.');
}

/** Direct document read keeps a published retraction accessible after it leaves the feed. */
export function watchNewsDetail(
  db: Firestore,
  id: string,
  observer: NewsDetailObserver,
): Unsubscribe {
  let closed = false;
  let stopVersions: Unsubscribe | undefined;
  const articleRef = doc(db, 'news', id);

  const stopNews = onSnapshot(
    articleRef,
    (snapshot) => {
      if (closed) return;
      if (!snapshot.exists()) {
        stopVersions?.();
        stopVersions = undefined;
        observer.news(null);
        return;
      }
      const parsed = newsSchema.safeParse({ ...snapshot.data(), id: snapshot.id });
      if (!parsed.success || parsed.data.workflow !== 'publicada') {
        stopVersions?.();
        stopVersions = undefined;
        observer.error(new Error('Esta noticia no está disponible para lectura.'));
        return;
      }
      observer.news(parsed.data);
      if (stopVersions) return;

      // Only subscribe to history after confirming that the parent article is public.
      stopVersions = onSnapshot(
        query(collection(articleRef, 'versions'), orderBy('version', 'desc')),
        (history) => {
          if (closed) return;
          const versions: News[] = [];
          for (const version of history.docs) {
            const result = newsSchema.safeParse({ ...version.data(), id });
            if (!result.success || result.data.workflow !== 'publicada') {
              observer.versionsError(new Error('Una versión del historial tiene datos inválidos.'));
              return;
            }
            versions.push(result.data);
          }
          observer.versions(versions);
        },
        (error) => observer.versionsError(asError(error)),
      );
    },
    (error) => observer.error(asError(error)),
  );

  return () => {
    closed = true;
    stopNews();
    stopVersions?.();
  };
}
