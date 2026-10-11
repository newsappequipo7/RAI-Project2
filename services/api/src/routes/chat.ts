import { chatRequestSchema } from '@repo/shared';
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { parseJsonBody } from '../http';
import { runChat } from '../rag/chat';

export const chatRoutes = new Hono<AppEnv>().post('/chat', async (c) => {
  const request = await parseJsonBody(c, chatRequestSchema);
  return c.json(await runChat(request, { env: c.env, uid: c.get('uid') }));
});
