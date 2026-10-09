import {
  MUST_KNOW_WINDOW_HOURS,
  newsSchema,
  resolvePublicFeedConfig,
  type News,
  type PublicFeedConfig,
} from '@repo/shared';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
  type Firestore,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';

const HOUR_MS = 3_600_000;
const REFRESH_MS = 60_000;
const QUERY_REFRESH_MS = HOUR_MS;

export interface NewsFeedSnapshot {
  news: News[];
  config: PublicFeedConfig;
}

interface NewsFeedObserver {
  next: (value: NewsFeedSnapshot) => void;
  error: (error: Error) => void;
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error('No se pudieron cargar las noticias.');
}

function parseNews(document: QueryDocumentSnapshot): News {
  const parsed = newsSchema.safeParse({ ...document.data(), id: document.id });
  if (!parsed.success) throw new Error(`La noticia ${document.id} tiene datos inválidos.`);
  return parsed.data;
}

export function mergeNewsFeed(
  current: QueryDocumentSnapshot[],
  essential: QueryDocumentSnapshot[],
  config: PublicFeedConfig,
  now: Date,
): News[] {
  const currentCutoff = now.getTime() - config.feedWindowHours * HOUR_MS;
  const essentialCutoff = now.getTime() - MUST_KNOW_WINDOW_HOURS * HOUR_MS;
  const byId = new Map<string, News>();

  for (const [documents, cutoff, onlyEssential] of [
    [current, currentCutoff, false],
    [essential, essentialCutoff, true],
  ] as const) {
    for (const document of documents) {
      const news = parseNews(document);
      const published = Date.parse(news.publishedAt ?? '');
      if (
        !Number.isFinite(published) ||
        published < cutoff ||
        published > now.getTime() ||
        (onlyEssential && news.importance !== 3)
      )
        continue;
      const previous = byId.get(news.id);
      if (
        !previous ||
        news.version > previous.version ||
        (news.version === previous.version && news.updatedAt > previous.updatedAt)
      )
        byId.set(news.id, news);
    }
  }

  return [...byId.values()]
    .filter((news) => news.workflow === 'publicada' && news.certainty !== 'retractada')
    .sort(
      (a, b) => Date.parse(b.publishedAt!) - Date.parse(a.publishedAt!) || a.id.localeCompare(b.id),
    );
}

/** One listener for public configuration and two rule-safe, indexed news queries. */
export function watchNewsFeed(
  db: Firestore,
  observer: NewsFeedObserver,
  clock: () => Date = () => new Date(),
): Unsubscribe {
  let closed = false;
  let config = resolvePublicFeedConfig(undefined);
  let current: QueryDocumentSnapshot[] | undefined;
  let essential: QueryDocumentSnapshot[] | undefined;
  let stopCurrent: Unsubscribe | undefined;
  let stopEssential: Unsubscribe | undefined;
  let startedAt = 0;
  let generation = 0;
  let stopConfig: Unsubscribe = () => {};
  let refreshTimer: ReturnType<typeof setInterval> | undefined;

  function emit() {
    if (closed || !current || !essential) return;
    try {
      observer.next({ news: mergeNewsFeed(current, essential, config, clock()), config });
    } catch (error) {
      fail(error);
    }
  }

  function fail(error: unknown) {
    if (closed) return;
    closed = true;
    stopCurrent?.();
    stopEssential?.();
    stopConfig();
    if (refreshTimer) clearInterval(refreshTimer);
    observer.error(asError(error));
  }

  function startQueries() {
    generation += 1;
    const ownGeneration = generation;
    stopCurrent?.();
    stopEssential?.();
    current = undefined;
    essential = undefined;
    startedAt = clock().getTime();
    const news = collection(db, 'news');
    const base = where('workflow', '==', 'publicada');
    const from = (hours: number) =>
      new Date(Math.max(0, startedAt - hours * HOUR_MS)).toISOString();
    const currentQuery = query(
      news,
      base,
      where('publishedAt', '>=', from(config.feedWindowHours)),
      orderBy('publishedAt', 'desc'),
    );
    const essentialQuery = query(
      news,
      base,
      where('importance', '==', 3),
      where('publishedAt', '>=', from(MUST_KNOW_WINDOW_HOURS)),
      orderBy('publishedAt', 'desc'),
    );
    stopCurrent = onSnapshot(
      currentQuery,
      (snapshot) => {
        if (closed || ownGeneration !== generation) return;
        current = snapshot.docs;
        emit();
      },
      fail,
    );
    stopEssential = onSnapshot(
      essentialQuery,
      (snapshot) => {
        if (closed || ownGeneration !== generation) return;
        essential = snapshot.docs;
        emit();
      },
      fail,
    );
  }

  stopConfig = onSnapshot(
    doc(db, 'config', 'public'),
    (snapshot) => {
      if (closed) return;
      const resolved = resolvePublicFeedConfig(snapshot.exists() ? snapshot.data() : undefined);
      const windowChanged = generation === 0 || resolved.feedWindowHours !== config.feedWindowHours;
      config = resolved;
      if (windowChanged) startQueries();
      else emit();
    },
    fail,
  );

  refreshTimer = setInterval(() => {
    if (closed) return;
    if (clock().getTime() - startedAt >= QUERY_REFRESH_MS) startQueries();
    else emit();
  }, REFRESH_MS);

  return () => {
    closed = true;
    generation += 1;
    stopCurrent?.();
    stopEssential?.();
    stopConfig();
    if (refreshTimer) clearInterval(refreshTimer);
  };
}
