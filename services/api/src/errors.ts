import type { ApiErrorBody } from '@repo/shared';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const unauthorized = (message = 'Missing or invalid token') =>
  new ApiError(401, 'unauthorized', message);

export const forbidden = (message = 'Admin access required') =>
  new ApiError(403, 'forbidden', message);

function errorBody(code: string, message: string): ApiErrorBody {
  return { error: { code, message } };
}

export function handleError(error: Error, c: Context) {
  if (error instanceof ApiError) {
    return c.json(errorBody(error.code, error.message), error.status);
  }

  console.error(error);
  return c.json(errorBody('internal_error', 'Unexpected error'), 500);
}

export function handleNotFound(c: Context) {
  return c.json(errorBody('not_found', 'Route not found'), 404);
}
