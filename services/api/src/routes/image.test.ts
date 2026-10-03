import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageSearchResponse } from '@repo/shared';
import { createApp } from '../app';
import type { Bindings } from '../env';
import { createTestD1 } from '../test-support/d1';
import { fakeKv } from '../test-support/kv';
import {
  ADMIN_UID,
  buildEnv,
  createTestKeys,
  signToken,
  USER_UID,
  type TestKeys,
} from '../test-support/tokens';

let keys: TestKeys;
let env: Bindings;

const OPENVERSE = {
  results: [
    {
      url: 'https://live.staticflickr.com/1/foto.jpg',
      thumbnail: 'https://api.openverse.org/v1/images/1/thumb/',
      title: 'Volcán de Fuego',
      creator: 'Ana Pérez',
      license: 'by',
      license_version: '4.0',
      license_url: 'https://creativecommons.org/licenses/by/4.0/',
      foreign_landing_url: 'https://www.flickr.com/photos/1',
    },
    {
      url: 'https://live.staticflickr.com/2/nc.jpg',
      title: 'No comercial',
      creator: 'Otro',
      license: 'by-nc',
      license_version: '2.0',
      foreign_landing_url: 'https://www.flickr.com/photos/2',
    },
    {
      url: 'javascript:alert(1)',
      title: 'URL peligrosa',
      license: 'by',
      license_version: '4.0',
      foreign_landing_url: 'https://www.flickr.com/photos/3',
    },
    {
      url: 'https://live.staticflickr.com/4/cc0.jpg',
      title: 'Dominio público',
      license: 'cc0',
      license_version: '1.0',
      foreign_landing_url: 'https://www.flickr.com/photos/4',
    },
  ],
};

const COMMONS = {
  query: {
    pages: [
      {
        title: 'File:Antigua Guatemala.jpg',
        imageinfo: [
          {
            url: 'https://upload.wikimedia.org/a/ag.jpg',
            thumburl: 'https://upload.wikimedia.org/a/320px-ag.jpg',
            descriptionurl: 'https://commons.wikimedia.org/wiki/File:Antigua_Guatemala.jpg',
            extmetadata: {
              LicenseShortName: { value: 'CC BY-SA 3.0' },
              LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/3.0' },
              Artist: {
                value: '<a href="//commons.wikimedia.org/wiki/User:Luis">Luis &amp; Co</a>',
              },
            },
          },
        ],
      },
      { title: 'File:Sin info.jpg' },
    ],
  },
};

function respond(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

function stubFetch(handlers: {
  openverse?: () => Promise<Response>;
  commons?: () => Promise<Response>;
}) {
  const calls: URL[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: URL | string) => {
      const url = new URL(String(input));
      calls.push(url);
      const handler = url.hostname.includes('openverse') ? handlers.openverse : handlers.commons;
      return handler ? handler() : respond({}, 500);
    }),
  );
  return calls;
}

async function post(path: string, body: unknown, uid: string = ADMIN_UID) {
  const app = createApp(() => async () => keys.verificationKey);
  const token = await signToken(keys, { uid });
  return app.request(
    path,
    {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    },
    env,
  );
}

beforeAll(async () => {
  keys = await createTestKeys();
});

beforeEach(() => {
  env = buildEnv({ DB: createTestD1().d1, KV: fakeKv() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /admin/image/search', () => {
  it('rejects non-admins and invalid bodies', async () => {
    expect((await post('/admin/image/search', { query: 'volcán' }, USER_UID)).status).toBe(403);
    expect((await post('/admin/image/search', { query: 'a' })).status).toBe(422);
    expect((await post('/admin/image/search', {})).status).toBe(422);
  });

  it('merges Openverse and Commons results with credit, license and links', async () => {
    const calls = stubFetch({
      openverse: () => respond(OPENVERSE),
      commons: () => respond(COMMONS),
    });

    const response = await post('/admin/image/search', { query: 'volcán' });
    const body = (await response.json()) as ImageSearchResponse;

    expect(response.status).toBe(200);
    expect(body.results).toEqual([
      {
        thumbUrl: 'https://api.openverse.org/v1/images/1/thumb/',
        url: 'https://live.staticflickr.com/1/foto.jpg',
        title: 'Volcán de Fuego',
        creator: 'Ana Pérez',
        license: 'CC BY 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
        sourceUrl: 'https://www.flickr.com/photos/1',
      },
      {
        thumbUrl: 'https://live.staticflickr.com/4/cc0.jpg',
        url: 'https://live.staticflickr.com/4/cc0.jpg',
        title: 'Dominio público',
        creator: '',
        license: 'CC0 1.0',
        licenseUrl: '',
        sourceUrl: 'https://www.flickr.com/photos/4',
      },
      {
        thumbUrl: 'https://upload.wikimedia.org/a/320px-ag.jpg',
        url: 'https://upload.wikimedia.org/a/ag.jpg',
        title: 'Antigua Guatemala',
        creator: 'Luis & Co',
        license: 'CC BY-SA 3.0',
        licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Antigua_Guatemala.jpg',
      },
    ]);

    const openverse = calls.find((url) => url.hostname.includes('openverse'));
    expect(openverse?.searchParams.get('q')).toBe('volcán');
    expect(openverse?.searchParams.get('license_type')).toBe('commercial');
    expect(
      calls.find((url) => url.hostname.includes('wikimedia'))?.searchParams.get('gsrsearch'),
    ).toContain('volcán');
  });

  it('drops non-commercial licenses and non-http(s) URLs', async () => {
    stubFetch({
      openverse: () => respond(OPENVERSE),
      commons: () => respond({ query: { pages: [] } }),
    });

    const body = (await (
      await post('/admin/image/search', { query: 'volcán' })
    ).json()) as ImageSearchResponse;
    const urls = body.results.map((item) => item.url);

    expect(urls).not.toContain('https://live.staticflickr.com/2/nc.jpg');
    expect(urls.some((url) => url.startsWith('javascript:'))).toBe(false);
    expect(body.results.every((item) => !/NC/.test(item.license))).toBe(true);
  });

  it('still answers when one source is down', async () => {
    stubFetch({
      openverse: () => Promise.reject(new Error('timeout')),
      commons: () => respond(COMMONS),
    });

    const body = (await (
      await post('/admin/image/search', { query: 'antigua' })
    ).json()) as ImageSearchResponse;
    expect(body.results.map((item) => item.title)).toEqual(['Antigua Guatemala']);
  });

  it('fails with provider_error when both sources are down', async () => {
    stubFetch({
      openverse: () => respond({}, 503),
      commons: () => Promise.reject(new Error('dns')),
    });

    const response = await post('/admin/image/search', { query: 'antigua' });
    expect(response.status).toBe(502);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
      'provider_error',
    );
  });
});

describe('POST /admin/image/generate', () => {
  const body = { newsId: 'n1', prompt: 'Gráficos abstractos de economía' };

  it('rejects non-admins and invalid bodies', async () => {
    expect((await post('/admin/image/generate', body, USER_UID)).status).toBe(403);
    expect((await post('/admin/image/generate', { newsId: 'n1', prompt: 'corto' })).status).toBe(
      422,
    );
  });

  it('is forbidden from the API while the imageGenEnabled flag is off (CA2)', async () => {
    const response = await post('/admin/image/generate', body);
    expect(response.status).toBe(403);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe('forbidden');
  });

  it('reaches the gateway but has no provider yet when the flag is on (ADR-011)', async () => {
    env = buildEnv({
      DB: createTestD1().d1,
      KV: fakeKv({ flags: { killSwitch: false, imageGenEnabled: true, chatMode: 'full' } }),
    });

    const response = await post('/admin/image/generate', body);
    expect(response.status).toBe(502);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
      'provider_error',
    );
  });

  it('the kill switch also blocks it', async () => {
    env = buildEnv({
      DB: createTestD1().d1,
      KV: fakeKv({ flags: { killSwitch: true, imageGenEnabled: true, chatMode: 'full' } }),
    });

    expect((await post('/admin/image/generate', body)).status).toBe(503);
  });
});
