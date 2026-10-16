import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env';
import { ApiError, invalidInput } from '../errors';

const HANDOFF_TTL_MS = 5 * 60 * 1000;
const MIN_ID_TOKEN_LENGTH = 20;
const MAX_ID_TOKEN_LENGTH = 4096;

const codeSchema = z.string().uuid();
const deliverSchema = z.object({
  idToken: z.string().min(MIN_ID_TOKEN_LENGTH).max(MAX_ID_TOKEN_LENGTH),
});

const handoffNotFound = () =>
  new ApiError(404, 'handoff_not_found', 'Unknown or expired login handoff');

function parseCode(raw: string): string {
  const parsed = codeSchema.safeParse(raw);
  if (!parsed.success) throw invalidInput('Invalid handoff code');
  return parsed.data;
}

interface HandoffRow {
  id_token: string | null;
}

export const authHandoffRoutes = new Hono<AppEnv>()
  .post('/auth/handoff', async (c) => {
    const now = Date.now();
    const code = crypto.randomUUID();
    await c.env.DB.prepare('DELETE FROM auth_handoffs WHERE expires_at <= ?').bind(now).run();
    await c.env.DB.prepare('INSERT INTO auth_handoffs (code, expires_at) VALUES (?, ?)')
      .bind(code, now + HANDOFF_TTL_MS)
      .run();
    return c.json({ code, expiresInSeconds: HANDOFF_TTL_MS / 1000 });
  })
  .post('/auth/handoff/:code', async (c) => {
    const code = parseCode(c.req.param('code'));
    const body = deliverSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) throw invalidInput('idToken is required');

    const delivered = await c.env.DB.prepare(
      `UPDATE auth_handoffs SET id_token = ?
       WHERE code = ? AND id_token IS NULL AND expires_at > ?
       RETURNING code`,
    )
      .bind(body.data.idToken, code, Date.now())
      .first();
    if (!delivered) throw handoffNotFound();
    return c.json({ ok: true });
  })
  .get('/auth/handoff/:code', async (c) => {
    const code = parseCode(c.req.param('code'));
    const row = await c.env.DB.prepare(
      'SELECT id_token FROM auth_handoffs WHERE code = ? AND expires_at > ?',
    )
      .bind(code, Date.now())
      .first<HandoffRow>();
    if (!row) throw handoffNotFound();
    if (!row.id_token) return c.json({ status: 'pending' as const });

    await c.env.DB.prepare('DELETE FROM auth_handoffs WHERE code = ?').bind(code).run();
    return c.json({ status: 'ready' as const, idToken: row.id_token });
  });
