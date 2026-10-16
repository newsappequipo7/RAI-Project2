import { API_BASE_URL } from './apiBaseUrl';

/** Hands the Google ID token to the Worker, where the waiting mobile app picks it up. */
export async function deliverHandoff(code: string, idToken: string): Promise<boolean> {
	try {
		const response = await fetch(`${API_BASE_URL}/auth/handoff/${encodeURIComponent(code)}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ idToken })
		});
		return response.ok;
	} catch {
		return false;
	}
}
