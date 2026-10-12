import {
  chatResponseSchema,
  DEFAULT_API_BASE_URL,
  type ChatRequest,
  type ChatResponse,
} from '@repo/shared';

import type { ChatFailure } from '../chat/presentation';

/** Public URL only: AI keys live in the Worker, never in the app (golden rule 6). */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_BASE_URL;

export class ChatApiError extends Error {
  constructor(readonly kind: ChatFailure) {
    super(kind);
  }
}

function failureFor(status: number): ChatFailure {
  if (status === 429) return 'rate_limited';
  if (status === 401 || status === 403) return 'unauthorized';
  return 'server';
}

/** `POST /chat` with the reader's Firebase ID token; the body is validated against the contract. */
export async function sendChat(
  request: ChatRequest,
  idToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ChatResponse> {
  let response: Response;
  try {
    response = await fetchImpl(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  } catch {
    throw new ChatApiError('network');
  }

  if (!response.ok) throw new ChatApiError(failureFor(response.status));

  const parsed = chatResponseSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new ChatApiError('server');
  return parsed.data;
}
