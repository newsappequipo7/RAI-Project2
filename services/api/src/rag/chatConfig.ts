/**
 * Chat retrieval knobs (CHAT-RAG.md §2). F4-06 calibrates them against the golden set, one at a
 * time; record each change and its run in a LOOP before editing a value here.
 */
export const CHAT_CONFIG = {
  /** Best cosine score below this → abstain without calling a model. Initial value, to calibrate. */
  abstainThreshold: 0.45,
  topK: 6,
  /** Ordering bonus for news of the reader's country on `mi_region`; never used to pass τ. */
  regionBoost: 0.1,
  /** Characters of the excerpt shown when a news item has no lead. */
  fallbackLeadLength: 280,
  cacheTtlSeconds: 15 * 60,
  /** Bump when the pipeline or prompt changes so stale cached answers are not served. */
  cacheVersion: 'v1',
} as const;
