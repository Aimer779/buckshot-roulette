import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiHandler } from '../http';

let server: Server | undefined;
const envKeys = ['TYPESAFE_API_KEY', 'OPENROUTER_API_KEY', 'JEV_PROVIDER', 'JEV_MODEL'] as const;
const saved: Partial<Record<(typeof envKeys)[number], string | undefined>> = {};

afterEach(async () => {
  vi.unstubAllGlobals();
  for (const key of envKeys) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
    delete saved[key];
  }
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server!.close((err) => (err ? reject(err) : resolve()))
    );
    server = undefined;
  }
});

function stashEnv() {
  for (const key of envKeys) saved[key] = process.env[key];
}

async function listen() {
  server = createServer(createApiHandler());
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const publicState = {
  dealerHP: 3,
  playerHP: 4,
  dealerMaxHP: 4,
  playerMaxHP: 4,
  liveCount: 3,
  blankCount: 2,
  shellsRemaining: 5,
  dealerItems: [{ id: 'saw-1', type: 'handsaw' }],
  playerItems: [],
  dealerSawActive: false,
  guillotineTriggered: false,
  skipPlayerTurn: false,
  currentRound: 2,
};

describe('POST /api/dealer/jev', () => {
  it('rejects a shells array in the body', async () => {
    stashEnv();
    delete process.env.TYPESAFE_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    const base = await listen();
    const response = await fetch(`${base}/api/dealer/jev`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...publicState, shells: [{ type: 'live' }] }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: '庄家状态无效。' });
  });

  it('returns a balanced fallback when no key is configured', async () => {
    stashEnv();
    delete process.env.TYPESAFE_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.JEV_PROVIDER;
    const base = await listen();
    const response = await fetch(`${base}/api/dealer/jev`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(publicState),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.fallback).toBe(true);
    expect(body.hud.reason).toBe('no-key');
    expect(body.turn.action).toBe('use-item');
    expect(body.turn.itemId).toBe('saw-1');
  });

  it('forwards a TypeSafe-shaped response into a turn', async () => {
    stashEnv();
    process.env.TYPESAFE_API_KEY = 'ts_test';
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.JEV_PROVIDER;
    const realFetch = globalThis.fetch.bind(globalThis);
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const href = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
      if (href.includes('127.0.0.1')) return realFetch(url, init);
      return {
        ok: true,
        json: async () => ({
          model: 'jev-1.13.0',
          answers: {
            chamber_likely_live: { type: 'noul', noul: 0.82 },
            should_double: { type: 'noul', noul: 0.91 },
            should_heal: { type: 'noul', noul: 0.1 },
          },
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const base = await listen();
    const response = await fetch(`${base}/api/dealer/jev`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(publicState),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.turn).toEqual({
      action: 'use-item',
      itemId: 'saw-1',
      shootTarget: 'dealer',
    });
    const upstream = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(upstream).toContain('https://api.typesafe.ai/v1/systemone');
  });
});
