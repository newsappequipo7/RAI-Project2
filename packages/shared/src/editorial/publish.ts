import type { News } from '../types';

export interface Publication {
  /** Fields the publish transaction writes on `news/{id}`. */
  patch: Pick<News, 'workflow' | 'publishedAt' | 'publishedBy' | 'version' | 'updatedAt'> & {
    indexPending: true;
  };
  /** What is stored in `news/{id}/versions/{version}`. */
  snapshot: News;
}

/**
 * Builds the publication of a validated news. `indexPending` is set in the same write as the
 * publication so a crash between publishing and indexing can never leave a published news that the
 * portal does not know needs indexing. The first `publishedAt` is kept on later versions.
 */
export function buildPublication(news: News, publishedBy: string, now: Date): Publication {
  const timestamp = now.toISOString();
  const patch: Publication['patch'] = {
    workflow: 'publicada',
    publishedAt: news.publishedAt ?? timestamp,
    publishedBy,
    version: news.version + 1,
    updatedAt: timestamp,
    indexPending: true,
  };

  return { patch, snapshot: { ...news, ...patch } };
}
