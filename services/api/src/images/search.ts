import type { ImageSearchResult } from '@repo/shared';

const OPENVERSE_URL = 'https://api.openverse.org/v1/images/';
const COMMONS_URL = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT = 'AI-News-App-UVG/1.0 (academic project; responsible-ai coursework)';
const PER_SOURCE = 12;
const TIMEOUT_MS = 8000;

type FetchFn = typeof fetch;

function httpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

interface AllowedLicense {
  label: string;
  url: string;
}

const CC_VERSIONS = new Set(['1.0', '2.0', '2.5', '3.0', '4.0']);

/** Only licenses with clear reuse terms enter the editor's free-license search. */
function allowedLicense(code: string, version: string): AllowedLicense | null {
  const normalized = code.toLowerCase();
  if (normalized === 'cc0' && (version === '' || version === '1.0')) {
    return { label: 'CC0 1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' };
  }
  if (normalized === 'pdm' && (version === '' || version === '1.0')) {
    return {
      label: 'Public Domain Mark 1.0',
      url: 'https://creativecommons.org/publicdomain/mark/1.0/',
    };
  }
  if ((normalized === 'by' || normalized === 'by-sa') && CC_VERSIONS.has(version)) {
    return {
      label: `CC ${normalized.toUpperCase()} ${version}`,
      url: `https://creativecommons.org/licenses/${normalized}/${version}/`,
    };
  }
  return null;
}

function commonsLicense(label: string): AllowedLicense | null {
  const normalized = label.trim().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').toUpperCase();
  if (normalized === 'CC0' || normalized === 'CC0 1.0') return allowedLicense('cc0', '1.0');
  if (normalized === 'PUBLIC DOMAIN MARK' || normalized === 'PUBLIC DOMAIN MARK 1.0') {
    return allowedLicense('pdm', '1.0');
  }
  const match = /^CC (BY(?: SA)?) (1\.0|2\.0|2\.5|3\.0|4\.0)$/.exec(normalized);
  return match
    ? allowedLicense((match[1] ?? '').toLowerCase().replace(' ', '-'), match[2] ?? '')
    : null;
}

function matchesLicenseUrl(value: unknown, expected: string): boolean {
  if (value == null || value === '') return true;
  const actual = httpUrl(value);
  if (!actual) return false;
  const parsed = new URL(actual);
  return (
    parsed.hostname.replace(/^www\./, '') === 'creativecommons.org' &&
    parsed.pathname.replace(/\/+$/, '') === new URL(expected).pathname.replace(/\/+$/, '')
  );
}

async function getJson(fetchFn: FetchFn, url: URL): Promise<unknown> {
  const response = await fetchFn(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${url.hostname} responded ${response.status}`);
  return response.json();
}

export async function searchOpenverse(
  query: string,
  fetchFn: FetchFn = fetch,
): Promise<ImageSearchResult[]> {
  const url = new URL(OPENVERSE_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('license_type', 'commercial');
  url.searchParams.set('page_size', String(PER_SOURCE));

  const body = (await getJson(fetchFn, url)) as { results?: Record<string, unknown>[] };

  return (body.results ?? []).flatMap((item) => {
    const imageUrl = httpUrl(item.url);
    const sourceUrl = httpUrl(item.foreign_landing_url);
    const license = allowedLicense(text(item.license), text(item.license_version));
    if (!imageUrl || !sourceUrl || !license || !matchesLicenseUrl(item.license_url, license.url)) {
      return [];
    }

    return [
      {
        thumbUrl: httpUrl(item.thumbnail) ?? imageUrl,
        url: imageUrl,
        title: text(item.title) || 'Sin título',
        creator: text(item.creator),
        license: license.label,
        licenseUrl: license.url,
        sourceUrl,
      },
    ];
  });
}

const stripHtml = (value: string) =>
  value
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

export async function searchCommons(
  query: string,
  fetchFn: FetchFn = fetch,
): Promise<ImageSearchResult[]> {
  const url = new URL(COMMONS_URL);
  const params: Record<string, string> = {
    action: 'query',
    generator: 'search',
    gsrnamespace: '6',
    gsrsearch: `${query} filetype:bitmap`,
    gsrlimit: String(PER_SOURCE),
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '320',
    format: 'json',
    formatversion: '2',
  };
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const body = (await getJson(fetchFn, url)) as {
    query?: { pages?: { title?: string; imageinfo?: Record<string, unknown>[] }[] };
  };

  return (body.query?.pages ?? []).flatMap((page) => {
    const info = page.imageinfo?.[0];
    if (!info) return [];

    const meta = (info.extmetadata ?? {}) as Record<string, { value?: unknown } | undefined>;
    const imageUrl = httpUrl(info.url);
    const sourceUrl = httpUrl(info.descriptionurl);
    const license = commonsLicense(text(meta.LicenseShortName?.value));
    if (
      !imageUrl ||
      !sourceUrl ||
      !license ||
      !matchesLicenseUrl(meta.LicenseUrl?.value, license.url)
    ) {
      return [];
    }

    return [
      {
        thumbUrl: httpUrl(info.thumburl) ?? imageUrl,
        url: imageUrl,
        title: (page.title ?? '').replace(/^File:/, '').replace(/\.\w+$/, '') || 'Sin título',
        creator: stripHtml(text(meta.Artist?.value)),
        license: license.label,
        licenseUrl: license.url,
        sourceUrl,
      },
    ];
  });
}

export class ImageSearchFailed extends Error {}

/**
 * Queries Openverse and Wikimedia Commons in parallel. One failing source is tolerated; both
 * failing is an error. No AI is involved, so it costs nothing.
 */
export async function searchFreeImages(
  query: string,
  fetchFn: FetchFn = fetch,
): Promise<ImageSearchResult[]> {
  const settled = await Promise.allSettled([
    searchOpenverse(query, fetchFn),
    searchCommons(query, fetchFn),
  ]);

  if (settled.every((result) => result.status === 'rejected')) {
    throw new ImageSearchFailed('Openverse and Wikimedia Commons are unreachable');
  }

  const seen = new Set<string>();
  return settled
    .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
    .filter((item) => !seen.has(item.url) && seen.add(item.url));
}
