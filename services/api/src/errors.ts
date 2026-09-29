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

export const invalidInput = (message: string) => new ApiError(422, 'invalid_input', message);

export const rateLimited = (message = 'Too many requests, try again later') =>
  new ApiError(429, 'rate_limited', message);

export const budgetBlocked = (message: string) => new ApiError(503, 'budget_blocked', message);

export const providerError = (message: string) => new ApiError(502, 'provider_error', message);

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
