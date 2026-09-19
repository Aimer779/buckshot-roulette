import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeItem } from '../../src/lib/itemFactory';
import { callJev, resolveJevDealerTurn, resolveJevProvider } from '../jev';
import type { JevDealerState } from '../../src/lib/dealerStrategies/jev/types';

function state(overrides: Partial<JevDealerState> = {}): JevDealerState {
  return {
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
    ...overrides,
  };
}

describe('resolveJevProvider', () => {
  it('prefers TypeSafe when auto and both keys exist', () => {
    const resolved = resolveJevProvider({
      JEV_PROVIDER: 'auto',
      TYPESAFE_API_KEY: 'ts_test',
      OPENROUTER_API_KEY: 'sk-or-test',
    });
    expect(resolved).toMatchObject({
      provider: 'typesafe',
      url: 'https://api.typesafe.ai/v1/systemone',
      model: 'jev-1.13.0',
    });
  });

  it('uses OpenRouter when JEV_PROVIDER=openrouter', () => {
    const resolved = resolveJevProvider({
      JEV_PROVIDER: 'openrouter',
      TYPESAFE_API_KEY: 'ts_test',
      OPENROUTER_API_KEY: 'sk-or-test',
    });
    expect(resolved).toMatchObject({
      provider: 'openrouter',
      url: 'https://openrouter.ai/api/alpha/decisions',
      model: 'typesafe/jev-1.13',
    });
  });

  it('falls back to OpenRouter in auto when only that key exists', () => {
    const resolved = resolveJevProvider({
      OPENROUTER_API_KEY: 'sk-or-test',
    });
    expect(resolved.provider).toBe('openrouter');
  });

  it('returns no-key when the requested provider has no key', () => {
    expect(resolveJevProvider({ JEV_PROVIDER: 'typesafe' }).provider).toBe('none');
    expect(resolveJevProvider({ JEV_PROVIDER: 'openrouter', TYPESAFE_API_KEY: 'ts' }).provider).toBe(
      'none'
    );
  });
});

describe('callJev', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts to the TypeSafe endpoint with the official model id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'jev-1.13.0',
        answers: { action: { type: 'choice', choice: 'shoot-player', confidence: 0.9 } },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await callJev(
      { model: 'ignored', state: { liveCount: 1 }, questions: {} },
      { env: { TYPESAFE_API_KEY: 'ts_test' }, timeoutMs: 1000 }
    );

    expect(result.ok).toBe(true);
    expect(result.provider).toBe('typesafe');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.typesafe.ai/v1/systemone');
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe('jev-1.13.0');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer ts_test');
  });

  it('posts to OpenRouter when that provider is selected', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ answers: { action: { choice: 'shoot-self', confidence: 0.7 } } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await callJev(
      { model: 'ignored', state: {}, questions: {} },
      {
        env: { JEV_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'sk-or-test' },
        timeoutMs: 1000,
      }
    );

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://openrouter.ai/api/alpha/decisions');
    expect(JSON.parse(String(init.body)).model).toBe('typesafe/jev-1.13');
    expect((init.headers as Record<string, string>)['HTTP-Referer']).toBeDefined();
  });
});

describe('resolveJevDealerTurn', () => {
  it('returns a balanced fallback without calling the model when no key is set', async () => {
    const call = vi.fn();
    const result = await resolveJevDealerTurn(state(), { env: {}, call });
    expect(call).not.toHaveBeenCalled();
    expect(result.fallback).toBe(true);
    expect(result.hud.reason).toBe('no-key');
    expect(result.turn.action).toBe('use-item');
    expect(result.turn).toMatchObject({ itemId: 'saw-1' });
  });

  it('uses the model action when confidence is high', async () => {
    const saw = makeItem('handsaw');
    const result = await resolveJevDealerTurn(
      state({ dealerItems: [saw] }),
      {
        env: { TYPESAFE_API_KEY: 'ts_test' },
        call: async () => ({
          ok: true,
          reason: 'ok',
          answers: {
            chamber_likely_live: { noul: 0.82 },
            should_double: { noul: 0.91 },
          },
          model: 'jev-1.13.0',
          provider: 'typesafe',
          latencyMs: 90,
        }),
      }
    );
    expect(result.ok).toBe(true);
    expect(result.turn).toEqual({
      action: 'use-item',
      itemId: saw.id,
      shootTarget: 'dealer',
    });
    expect(result.hud.provider).toBe('typesafe');
  });

  it('honors a lowered confidenceMin from the client', async () => {
    const result = await resolveJevDealerTurn(
      state({ dealerItems: [], confidenceMin: 0.1 }),
      {
        env: { TYPESAFE_API_KEY: 'ts_test' },
        call: async () => ({
          ok: true,
          reason: 'ok',
          answers: {
            chamber_likely_live: { noul: 0.2 },
          },
          model: 'jev-1.13.0',
          provider: 'typesafe',
          latencyMs: 40,
        }),
      }
    );
    expect(result.ok).toBe(true);
    expect(result.fallback).toBe(false);
    expect(result.turn).toEqual({ action: 'shoot', target: 'dealer' });
  });
});
