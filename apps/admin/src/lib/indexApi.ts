import {
	toIndexInput,
	type HealthResponse,
	type IndexInput,
	type IndexUpsertResponse,
	type News
} from '@repo/shared';
import { apiFetch } from './api';

export function upsertNews(news: News): Promise<IndexUpsertResponse> {
	return apiFetch<IndexUpsertResponse>('/admin/index/upsert', {
		method: 'POST',
		body: JSON.stringify({ news: [toIndexInput(news)] })
	});
}

export function rebuildNews(news: IndexInput[]): Promise<IndexUpsertResponse> {
	return apiFetch<IndexUpsertResponse>('/admin/index/rebuild', {
		method: 'POST',
		body: JSON.stringify({ news })
	});
}

export function fetchHealth(): Promise<HealthResponse> {
	return apiFetch<HealthResponse>('/health');
}
