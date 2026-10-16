// Manual Google OAuth 2.0 implicit flow, used instead of Firebase's
// signInWithPopup/signInWithRedirect: both rely on browser mechanisms
// (window.open, IndexedDB-backed pending-redirect state) that don't survive
// inside the restricted ASWebAuthenticationSession that expo-web-browser opens
// on iOS (see ADR-003). A single `window.location.href` navigation, like this
// one, is exactly what that session type supports.
const GOOGLE_CLIENT_ID = '452377084333-jm1j5lkjlv4akq73a0dt1sa30gh6v56u.apps.googleusercontent.com';
const BRIDGE_URL = 'https://ai-news-app-f24cf.web.app/auth/mobile';
const PENDING_REDIRECT_KEY = 'pendingRedirect';
const STATE_PARAM = 'state';
const NONCE_BYTES = 16;

// crypto.randomUUID is missing in some Android browsers (older Samsung Internet, WebViews).
function createNonce(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function rememberPendingRedirect(redirect: string): void {
	try {
		sessionStorage.setItem(PENDING_REDIRECT_KEY, redirect);
	} catch {
		// The redirect also travels in `state`; storage is only a fallback.
	}
}

export function buildGoogleAuthUrl(redirect: string): string {
	rememberPendingRedirect(redirect);

	const params = new URLSearchParams({
		client_id: GOOGLE_CLIENT_ID,
		redirect_uri: BRIDGE_URL,
		response_type: 'id_token',
		scope: 'openid email profile',
		nonce: createNonce(),
		state: redirect,
		prompt: 'select_account'
	});

	return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function consumePendingRedirect(): string | null {
	try {
		const redirect = sessionStorage.getItem(PENDING_REDIRECT_KEY);
		sessionStorage.removeItem(PENDING_REDIRECT_KEY);
		return redirect;
	} catch {
		return null;
	}
}

function readHashParam(hash: string, name: string): string | null {
	return new URLSearchParams(hash.replace(/^#/, '')).get(name);
}

export function extractIdTokenFromHash(hash: string): string | null {
	return readHashParam(hash, 'id_token');
}

export function extractStateFromHash(hash: string): string | null {
	return readHashParam(hash, STATE_PARAM);
}

export function extractErrorFromHash(hash: string): string | null {
	return readHashParam(hash, 'error');
}
