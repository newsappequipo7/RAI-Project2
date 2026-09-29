import type { Context } from 'hono';
import type { z } from 'zod';
import { invalidInput } from './errors';

export async function parseJsonBody<T>(c: Context, schema: z.ZodType<T>): Promise<T> {
  let rawBody: unknown;

  try {
    rawBody = await c.req.json();
  } catch {
    throw invalidInput('Body must be valid JSON');
  }

  const parsed = schema.safeParse(rawBody);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
      .join('; ');
    throw invalidInput(details);
  }

  return parsed.data;
}
