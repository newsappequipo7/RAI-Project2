const ALLOWED_REDIRECT_PREFIXES = ['exp://', 'exps://', 'newsapp://'];

export function isAllowedRedirect(redirect: string): boolean {
	return ALLOWED_REDIRECT_PREFIXES.some((prefix) => redirect.startsWith(prefix));
}

const ANDROID_USER_AGENT = /android/i;

/**
 * Chrome on Android refuses to navigate to custom schemes from script, but follows
 * intent:// URLs. No package is pinned: with one, Android sends the user to the Play
 * Store whenever that exact package does not claim the URL, instead of opening
 * whichever installed app handles the scheme (Expo Go or our own build).
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
	return `intent://${rest}#Intent;scheme=${scheme};action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end`;
}
