const ALLOWED_REDIRECT_PREFIXES = ['exp://', 'exps://', 'newsapp://'];

export function isAllowedRedirect(redirect: string): boolean {
	return ALLOWED_REDIRECT_PREFIXES.some((prefix) => redirect.startsWith(prefix));
}

const EXPO_GO_ANDROID_PACKAGE = 'host.exp.exponent';
const ANDROID_USER_AGENT = /android/i;

/**
 * Chrome on Android refuses to navigate to custom schemes from script, but follows
 * intent:// URLs, which name the target app explicitly.
 */
export function toAppLaunchUrl(appUrl: string, userAgent: string): string {
	if (!ANDROID_USER_AGENT.test(userAgent)) {
		return appUrl;
	}

	const match = /^([a-z]+):\/\/(.*)$/.exec(appUrl);
	const scheme = match?.[1];
	const rawRest = match?.[2];
	if (!scheme || rawRest === undefined) {
		return appUrl;
	}

	// An intent URI reserves the fragment for its own #Intent section, so the token moves to the query.
	const rest = rawRest.replace('#id_token=', '?id_token=');
	const packageName = scheme.startsWith('exp') ? `package=${EXPO_GO_ANDROID_PACKAGE};` : '';
	return `intent://${rest}#Intent;scheme=${scheme};${packageName}end`;
}
