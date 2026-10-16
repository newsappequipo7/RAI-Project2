export const AUTH_BRIDGE_URL = 'https://ai-news-app-f24cf.web.app/auth/mobile';

const ID_TOKEN_MARKERS = ['#id_token=', '?id_token='];

export function extractIdTokenFromRedirectUrl(url: string): string | null {
  for (const marker of ID_TOKEN_MARKERS) {
    const markerIndex = url.indexOf(marker);

    if (markerIndex !== -1) {
      return url.slice(markerIndex + marker.length).split('&')[0] ?? null;
    }
  }

  return null;
}
