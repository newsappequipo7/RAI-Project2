import type { Certainty, ChatBlock } from '../types';

/** From most to least certain. A retracted news never reaches the chat, but it ranks last. */
const CERTAINTY_ORDER: readonly Certainty[] = [
  'confirmada',
  'en_desarrollo',
  'disputada',
  'retractada',
];

/** Certainties that require the chat to warn the reader (CHAT-RAG.md §2 step 9). */
export const UNCERTAIN_CERTAINTIES: readonly Certainty[] = ['en_desarrollo', 'disputada'];

/** The least certain of the given certainties; the one a `mixta` block shows. */
export function lowestCertainty(certainties: Certainty[]): Certainty | undefined {
  return [...certainties].sort(
    (left, right) => CERTAINTY_ORDER.indexOf(right) - CERTAINTY_ORDER.indexOf(left),
  )[0];
}

/**
 * Certainty of a chat block, inherited from the news it cites and never from the model: the
 * shared certainty when all agree, `mixta` when they differ.
 */
export function blockCertainty(certainties: Certainty[]): ChatBlock['certainty'] | undefined {
  const distinct = [...new Set(certainties)];
  if (distinct.length === 0) return undefined;
  return distinct.length === 1 ? distinct[0] : 'mixta';
}
