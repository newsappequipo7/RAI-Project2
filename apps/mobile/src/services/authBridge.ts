export const AUTH_BRIDGE_URL = 'https://ai-news-app-f24cf.web.app/auth/mobile';

export function extractIdTokenFromRedirectUrl(url: string): string | null {
  const fragmentIndex = url.indexOf('#id_token=');

  if (fragmentIndex === -1) {
    return null;
  }

  return url.slice(fragmentIndex + '#id_token='.length);
}
