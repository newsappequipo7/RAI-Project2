// Manual Google OAuth 2.0 implicit flow, used instead of Firebase's
// signInWithPopup/signInWithRedirect: both rely on browser mechanisms
// (window.open, IndexedDB-backed pending-redirect state) that don't survive
// inside the restricted ASWebAuthenticationSession that expo-web-browser opens
// on iOS (see ADR-003). A single `window.location.href` navigation, like this
// one, is exactly what that session type supports.
const GOOGLE_CLIENT_ID = '452377084333-jm1j5lkjlv4akq73a0dt1sa30gh6v56u.apps.googleusercontent.com';
const BRIDGE_URL = 'https://ai-news-app-f24cf.web.app/auth/mobile';
const PENDING_REDIRECT_KEY = 'pendingRedirect';

export function beginGoogleSignIn(redirect: string): void {
	sessionStorage.setItem(PENDING_REDIRECT_KEY, redirect);

	const params = new URLSearchParams({
		client_id: GOOGLE_CLIENT_ID,
		redirect_uri: BRIDGE_URL,
		response_type: 'id_token',
		scope: 'openid email profile',
		nonce: crypto.randomUUID(),
		prompt: 'select_account'
	});

	window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function consumePendingRedirect(): string | null {
	const redirect = sessionStorage.getItem(PENDING_REDIRECT_KEY);
	sessionStorage.removeItem(PENDING_REDIRECT_KEY);
	return redirect;
}

export function extractIdTokenFromHash(hash: string): string | null {
	const params = new URLSearchParams(hash.replace(/^#/, ''));
	return params.get('id_token');
}
