import { resolvePublicFeedConfig, type News, type PublicFeedConfig } from '@repo/shared';
import { useCallback, useEffect, useState } from 'react';

import { useProfile } from '@/src/profile/ProfileProvider';
import { getFirebaseDb } from '@/src/services/firebase';
import { watchNewsFeed } from '@/src/services/newsFeed';

export type NewsFeedStatus = 'loading' | 'ready' | 'empty' | 'error';

export interface NewsFeedState {
  status: NewsFeedStatus;
  news: News[];
  config: PublicFeedConfig;
  error: string | null;
  retry: () => void;
}

const initialState: Omit<NewsFeedState, 'retry'> = {
  status: 'loading',
  news: [],
  config: resolvePublicFeedConfig(undefined),
  error: null,
};

export function useNewsFeed(): NewsFeedState {
  const { profile } = useProfile();
  const [state, setState] = useState<Omit<NewsFeedState, 'retry'>>(initialState);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((previous) => previous + 1), []);

  useEffect(() => {
    setState(initialState);
    if (!profile) return;
    try {
      return watchNewsFeed(getFirebaseDb(), {
        next: ({ news, config }) =>
          setState({ status: news.length ? 'ready' : 'empty', news, config, error: null }),
        error: (error) =>
          setState((previous) => ({
            ...previous,
            status: 'error',
            error: error.message || 'No se pudieron cargar las noticias.',
          })),
      });
    } catch (error) {
      setState({
        ...initialState,
        status: 'error',
        error: error instanceof Error ? error.message : 'No se pudieron cargar las noticias.',
      });
    }
  }, [profile?.uid, attempt]);

  return { ...state, retry };
}
