const ALLOWED_REDIRECT_PREFIXES = ['exp://', 'newsapp://'];

export function isAllowedRedirect(redirect: string): boolean {
	return ALLOWED_REDIRECT_PREFIXES.some((prefix) => redirect.startsWith(prefix));
}
