import { CHAT_MAX_MESSAGE, type ChatResponse, type News } from '@repo/shared';
import { useCallback, useRef, useState } from 'react';

import { getFirebaseAuth, getFirebaseDb } from '@/src/services/firebase';
import { ChatApiError, sendChat } from '@/src/services/chatApi';
import { recordChatTopic } from '@/src/services/chatTopic';

import { chatTopic, toHistory, type ChatEntry, type ChatFailure } from './presentation';

export type ChatStatus =
  | { state: 'idle' }
  | { state: 'sending' }
  | { state: 'failed'; failure: ChatFailure; question: string };

let nextId = 0;
const newId = () => `m-${Date.now()}-${(nextId += 1)}`;

/**
 * Chat state lives only in React memory (CHAT-RAG §4): closing the app or tapping
 * "Nueva conversación" forgets it. Nothing is written except the `chat_topic` interest signal.
 */
export function useChat(locationId: string | undefined, newsById: Map<string, News>) {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [status, setStatus] = useState<ChatStatus>({ state: 'idle' });
  const generation = useRef(0);

  const ask = useCallback(
    async (rawQuestion: string) => {
      const question = rawQuestion.trim().slice(0, CHAT_MAX_MESSAGE);
      const user = getFirebaseAuth().currentUser;
      if (!question || !locationId || status.state === 'sending') return;
      if (!user) {
        setStatus({ state: 'failed', failure: 'unauthorized', question });
        return;
      }

      const current = generation.current;
      const history = toHistory(entries);
      setEntries((previous) => [...previous, { id: newId(), role: 'user', text: question }]);
      setStatus({ state: 'sending' });

      let response: ChatResponse;
      try {
        const token = await user.getIdToken();
        response = await sendChat({ message: question, locationId, history }, token);
      } catch (error) {
        if (generation.current !== current) return;
        // The question stays visible; retry sends it again without duplicating the bubble.
        setEntries((previous) => previous.slice(0, -1));
        setStatus({
          state: 'failed',
          failure: error instanceof ChatApiError ? error.kind : 'network',
          question,
        });
        return;
      }

      if (generation.current !== current) return;
      setEntries((previous) => [
        ...previous,
        { id: newId(), role: 'assistant', question, response },
      ]);
      setStatus({ state: 'idle' });

      const topic = chatTopic(response, newsById);
      if (topic) {
        recordChatTopic(getFirebaseDb(), user.uid, topic).catch(() => {
          // A lost interest signal must never break the conversation.
        });
      }
    },
    [entries, locationId, newsById, status.state],
  );

  const retry = useCallback(() => {
    if (status.state === 'failed') void ask(status.question);
  }, [ask, status]);

  const reset = useCallback(() => {
    generation.current += 1;
    setEntries([]);
    setStatus({ state: 'idle' });
  }, []);

  return { entries, status, ask, retry, reset };
}
