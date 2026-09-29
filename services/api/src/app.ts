import { Hono } from 'hono';
import type { AppEnv } from './env';
import { handleError, handleNotFound } from './errors';
import { requireAdmin } from './middleware/admin';
import { getFirebaseKeyResolver, requireAuth, type KeyResolver } from './middleware/auth';
import { corsMiddleware } from './middleware/cors';
import { adminRoutes } from './routes/admin';
import { healthRoutes } from './routes/health';

export function createApp(resolveKeys: () => KeyResolver = getFirebaseKeyResolver) {
  const app = new Hono<AppEnv>();

  app.use('*', corsMiddleware);
  app.onError(handleError);
  app.notFound(handleNotFound);

  app.route('/', healthRoutes);

  app.use('/admin/*', requireAuth(resolveKeys), requireAdmin);
  app.route('/admin', adminRoutes);

  return app;
}
