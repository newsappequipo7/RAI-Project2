import { API_BASE_URL } from './chatApi';

const POLL_INTERVAL_MS = 2_000;
const MS_PER_SECOND = 1_000;

interface HandoffTicket {
  code: string;
  expiresInSeconds: number;
}

type HandoffStatus = { status: 'pending' } | { status: 'ready'; idToken: string };

/** Asks the Worker for a one-time slot the web bridge will drop the Google ID token into. */
export async function openHandoff(): Promise<HandoffTicket> {
  const response = await fetch(`${API_BASE_URL}/auth/handoff`, { method: 'POST' });
  if (!response.ok) throw new Error('No se pudo preparar el inicio de sesión.');
  return (await response.json()) as HandoffTicket;
}

async function readHandoff(code: string): Promise<HandoffStatus | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/handoff/${code}`);
    if (!response.ok) return null;
    return (await response.json()) as HandoffStatus;
  } catch {
    return { status: 'pending' };
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Polls until the bridge delivers the token. Resolves null when the slot expires, is
 * rejected by the Worker, or `isCancelled` turns true (e.g. the login screen unmounted).
 */
export async function waitForHandoffToken(
  ticket: HandoffTicket,
  isCancelled: () => boolean,
): Promise<string | null> {
  const deadline = Date.now() + ticket.expiresInSeconds * MS_PER_SECOND;

  while (Date.now() < deadline && !isCancelled()) {
    const result = await readHandoff(ticket.code);
    if (!result) return null;
    if (result.status === 'ready') return result.idToken;
    await wait(POLL_INTERVAL_MS);
  }

  return null;
}
