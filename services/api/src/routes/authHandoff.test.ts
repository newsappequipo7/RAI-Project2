import { describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { buildEnv } from '../test-support/tokens';

const ID_TOKEN = 'header.payload.signature-of-a-google-id-token';

function setup() {
  const app = createApp();
  const env = buildEnv();
  const request = (path: string, init?: RequestInit) => app.request(path, init, env);
  const deliver = (code: string, body: unknown) =>
    request(`/auth/handoff/${code}`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  return { request, deliver };
}

async function openHandoff(request: ReturnType<typeof setup>['request']): Promise<string> {
  const response = await request('/auth/handoff', { method: 'POST' });
  expect(response.status).toBe(200);
  const { code } = (await response.json()) as { code: string };
  return code;
}

describe('auth handoff', () => {
  it('stays pending until the bridge delivers the token', async () => {
    const { request } = setup();
    const code = await openHandoff(request);

    const response = await request(`/auth/handoff/${code}`);

    expect(await response.json()).toEqual({ status: 'pending' });
  });

  it('hands the delivered token over exactly once', async () => {
    const { request, deliver } = setup();
    const code = await openHandoff(request);

    expect((await deliver(code, { idToken: ID_TOKEN })).status).toBe(200);
    const first = await request(`/auth/handoff/${code}`);
    const second = await request(`/auth/handoff/${code}`);

    expect(await first.json()).toEqual({ status: 'ready', idToken: ID_TOKEN });
    expect(second.status).toBe(404);
  });

  it('rejects a second delivery to the same code', async () => {
    const { request, deliver } = setup();
    const code = await openHandoff(request);

    await deliver(code, { idToken: ID_TOKEN });
    const overwrite = await deliver(code, { idToken: `${ID_TOKEN}-attacker` });

    expect(overwrite.status).toBe(404);
  });

  it('rejects deliveries to codes it never issued', async () => {
    const { deliver } = setup();

    const response = await deliver(crypto.randomUUID(), { idToken: ID_TOKEN });

    expect(response.status).toBe(404);
  });

  it('rejects malformed codes and bodies', async () => {
    const { request, deliver } = setup();
    const code = await openHandoff(request);

    expect((await request('/auth/handoff/not-a-uuid')).status).toBe(422);
    expect((await deliver(code, { idToken: 'short' })).status).toBe(422);
  });
});
