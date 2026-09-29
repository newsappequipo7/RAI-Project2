import type { ApiErrorBody } from '@repo/shared';
import { session } from './session.svelte';

const DEFAULT_API_BASE_URL = 'https://news-api.diegovalenzuela.workers.dev';
const API_BASE_URL = import.meta.env.VITE_API_URL || DEFAULT_API_BASE_URL;

export class ApiRequestError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		message: string
	) {
		super(message);
	}
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
	const token = await session.user?.getIdToken();

	if (!token) {
		throw new ApiRequestError(401, 'unauthorized', 'No hay sesión activa');
	}

	const response = await fetch(`${API_BASE_URL}${path}`, {
		...init,
		headers: {
			...init.headers,
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		}
	});

	if (!response.ok) {
		const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
		throw new ApiRequestError(
			response.status,
			body?.error.code ?? 'unknown',
			body?.error.message ?? `Error ${response.status}`
		);
	}

	return (await response.json()) as T;
}
