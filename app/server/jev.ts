import { z } from 'zod';
import { answersToDecision, fallbackTurn } from '../src/lib/dealerStrategies/jev/answersToDecision';
import { buildJevRequest } from '../src/lib/dealerStrategies/jev/buildJevRequest';
import { resolveForcedDealerTurn } from '../src/lib/dealerStrategies/jev/forced';
import { JEV_PINNED_OPENROUTER_MODEL, JEV_PINNED_TYPESAFE_MODEL, JEV_POLICY_VERSION } from '../src/lib/dealerStrategies/jev/policy';
import {
  clampJevConfidenceMin,
  JEV_CONFIDENCE_THRESHOLD,
  type JevAnswers,
  type JevDealerResponse,
  type JevDealerState,
  type JevProvider,
} from '../src/lib/dealerStrategies/jev/types';
import type { DealerContext } from '../src/lib/dealerStrategies/types';

const TYPESAFE_URL = 'https://api.typesafe.ai/v1/systemone';
const OPENROUTER_URL = 'https://openrouter.ai/api/alpha/decisions';

const ITEM_TYPES = [
  'magnifier',
  'handcuffs',
  'cigarette',
  'beer',
  'handsaw',
  'adrenaline',
  'medicine',
  'inverter',
  'phone',
] as const;

const itemSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.enum(ITEM_TYPES),
});

export const jevDealerStateSchema = z
  .object({
    dealerHP: z.number().int().min(0).max(20),
    playerHP: z.number().int().min(0).max(20),
    dealerMaxHP: z.number().int().min(1).max(20),
    playerMaxHP: z.number().int().min(1).max(20),
    liveCount: z.number().int().min(0).max(16),
    blankCount: z.number().int().min(0).max(16),
    shellsRemaining: z.number().int().min(0).max(16),
    dealerItems: z.array(itemSchema).max(16),
    playerItems: z.array(itemSchema).max(16),
    dealerSawActive: z.boolean(),
    guillotineTriggered: z.boolean(),
    skipPlayerTurn: z.boolean(),
    currentRound: z.number().int().min(1).max(8).optional(),
    confidenceMin: z.number().min(0).max(1).optional(),
    knownChamber: z.enum(['live', 'blank']).nullable().optional(),
  })
  .strict();

export type ResolvedJevProvider =
  | {
      provider: Exclude<JevProvider, 'none'>;
      url: string;
      key: string;
      model: string;
    }
  | { provider: 'none'; reason: 'no-key' };

export function resolveJevProvider(env: NodeJS.ProcessEnv = process.env): ResolvedJevProvider {
  const explicit = (env.JEV_PROVIDER ?? 'auto').trim().toLowerCase();
  const tsKey = env.TYPESAFE_API_KEY?.trim();
  const orKey = env.OPENROUTER_API_KEY?.trim();
  const override = env.JEV_MODEL?.trim();

  if (explicit === 'typesafe') {
    if (!tsKey) return { provider: 'none', reason: 'no-key' };
    return {
      provider: 'typesafe',
      url: TYPESAFE_URL,
      key: tsKey,
      model: override || JEV_PINNED_TYPESAFE_MODEL,
    };
  }
  if (explicit === 'openrouter') {
    if (!orKey) return { provider: 'none', reason: 'no-key' };
    return {
      provider: 'openrouter',
      url: OPENROUTER_URL,
      key: orKey,
      model: override || JEV_PINNED_OPENROUTER_MODEL,
    };
  }

  if (tsKey) {
    return {
      provider: 'typesafe',
      url: TYPESAFE_URL,
      key: tsKey,
      model: override || JEV_PINNED_TYPESAFE_MODEL,
    };
  }
  if (orKey) {
    return {
      provider: 'openrouter',
      url: OPENROUTER_URL,
      key: orKey,
      model: override || JEV_PINNED_OPENROUTER_MODEL,
    };
  }
  return { provider: 'none', reason: 'no-key' };
}

function timeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.JEV_TIMEOUT_MS);
  return Number.isFinite(raw) && raw >= 500 ? raw : 2500;
}

function confidenceMin(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.JEV_CONFIDENCE_MIN);
  return Number.isFinite(raw) && raw >= 0 && raw <= 1 ? raw : JEV_CONFIDENCE_THRESHOLD;
}

export interface CallJevResult {
  ok: boolean;
  reason: string;
  answers: JevAnswers | null;
  model: string;
  provider: JevProvider;
  latencyMs: number;
}

export async function callJev(
  body: { model: string; state: unknown; questions: unknown },
  options: { timeoutMs?: number; env?: NodeJS.ProcessEnv } = {}
): Promise<CallJevResult> {
  const env = options.env ?? process.env;
  const resolved = resolveJevProvider(env);
  if (resolved.provider === 'none') {
    return {
      ok: false,
      reason: 'no-key',
      answers: null,
      model: 'none',
      provider: 'none',
      latencyMs: 0,
    };
  }

  const payload = { ...body, model: resolved.model };
  const started = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), options.timeoutMs ?? timeoutMs(env));

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${resolved.key}`,
      'Content-Type': 'application/json',
    };
    if (resolved.provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://github.com/Aimer779/buckshot-roulette';
      headers['X-Title'] = 'Buckshot Roulette × Jev';
    }

    const res = await fetch(resolved.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: ac.signal,
    });
    const json = (await res.json()) as { answers?: JevAnswers; model?: string };
    if (!res.ok) {
      return {
        ok: false,
        reason: `http-${res.status}`,
        answers: null,
        model: json.model ?? payload.model,
        provider: resolved.provider,
        latencyMs: Date.now() - started,
      };
    }
    return {
      ok: true,
      reason: 'ok',
      answers: json.answers ?? null,
      model: json.model ?? payload.model,
      provider: resolved.provider,
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    return {
      ok: false,
      reason: name === 'AbortError' ? 'timeout' : 'network',
      answers: null,
      model: payload.model,
      provider: resolved.provider,
      latencyMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function toDealerContext(state: JevDealerState): DealerContext {
  return {
    dealerHP: state.dealerHP,
    playerHP: state.playerHP,
    dealerMaxHP: state.dealerMaxHP,
    liveCount: state.liveCount,
    blankCount: state.blankCount,
    shellsRemaining: state.shellsRemaining,
    dealerItems: state.dealerItems,
    dealerSawActive: state.dealerSawActive,
    guillotineTriggered: state.guillotineTriggered,
    playerItems: state.playerItems,
    playerMaxHP: state.playerMaxHP,
    skipPlayerTurn: state.skipPlayerTurn,
    currentRound: state.currentRound,
    confidenceMin: state.confidenceMin,
    knownChamber: state.knownChamber ?? null,
  };
}

export async function resolveJevDealerTurn(
  state: JevDealerState,
  options: { env?: NodeJS.ProcessEnv; call?: typeof callJev } = {}
): Promise<JevDealerResponse> {
  const env = options.env ?? process.env;
  const ctx = toDealerContext(state);
  const forced = resolveForcedDealerTurn(ctx);
  if (forced) return forced;

  const resolved = resolveJevProvider(env);
  if (resolved.provider === 'none') {
    return {
      ok: false,
      fallback: true,
      turn: fallbackTurn(ctx),
      hud: {
        action: 'fallback',
        confidence: 0,
        probabilities: {},
        nouls: {},
        liveBelief: 0.5,
        shootTarget: 'player',
        latencyMs: 0,
        model: 'balanced',
        provider: 'none',
        fallback: true,
        reason: 'no-key',
        ruleFired: 'fallback',
        policyVersion: JEV_POLICY_VERSION,
      },
    };
  }

  const request = buildJevRequest(ctx, resolved.model);
  const caller = options.call ?? callJev;
  const result = await caller(request, { env, timeoutMs: timeoutMs(env) });
  const decision = answersToDecision(ctx, result.answers, {
    latencyMs: result.latencyMs,
    model: result.model,
    provider: result.provider,
    fallback: !result.ok,
    reason: result.ok ? undefined : result.reason,
    confidenceMin: clampJevConfidenceMin(state.confidenceMin ?? confidenceMin(env)),
  });
  if (!process.env.VITEST) {
    console.info(
      JSON.stringify({
        tag: 'jev-turn',
        policyVersion: JEV_POLICY_VERSION,
        model: decision.hud.model,
        ruleFired: decision.hud.ruleFired,
        action: decision.hud.action,
        liveBelief: decision.hud.liveBelief,
        nouls: decision.hud.nouls,
        fallback: decision.fallback,
        reason: decision.hud.reason,
        latencyMs: decision.hud.latencyMs,
      })
    );
  }
  return decision;
}
