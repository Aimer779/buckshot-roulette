import { balancedStrategy } from '../balancedStrategy';
import {
  resolveDealerTurnDecision,
  type DealerTurnDecision,
} from '../resolveDealerTurn';
import type { DealerContext } from '../types';
import { composeJevTurn } from './compose';
import {
  clampJevConfidenceMin,
  JEV_CONFIDENCE_THRESHOLD,
  type JevAnswers,
  type JevDealerResponse,
  type JevHud,
  type JevProvider,
} from './types';
import { JEV_POLICY_VERSION } from './policy';
import { toDealerContextFromJevState } from './buildJevRequest';

export function fallbackTurn(ctx: DealerContext): DealerTurnDecision {
  return resolveDealerTurnDecision(balancedStrategy, toDealerContextFromJevState(ctx));
}

export function answersToDecision(
  ctx: DealerContext,
  answers: JevAnswers | null | undefined,
  meta: {
    latencyMs: number;
    model: string;
    provider: JevProvider;
    fallback: boolean;
    reason?: string;
    confidenceMin?: number;
  }
): JevDealerResponse {
  const publicCtx = toDealerContextFromJevState(ctx);
  const shootT = clampJevConfidenceMin(meta.confidenceMin ?? JEV_CONFIDENCE_THRESHOLD);

  if (meta.fallback) {
    const composed = composeJevTurn(publicCtx, answers, shootT);
    const hud: JevHud = {
      action: 'fallback',
      confidence: 0,
      probabilities: composed.nouls,
      nouls: composed.nouls,
      liveBelief: composed.liveBelief,
      shootTarget: composed.turn.action === 'shoot' && composed.turn.target === 'self' ? 'self' : 'player',
      latencyMs: meta.latencyMs,
      model: meta.model,
      provider: meta.provider,
      fallback: true,
      reason: meta.reason ?? 'fallback',
      ruleFired: 'fallback',
      policyVersion: JEV_POLICY_VERSION,
    };
    return { ok: false, fallback: true, turn: fallbackTurn(publicCtx), hud };
  }

  const composed = composeJevTurn(publicCtx, answers, shootT);
  const shootTarget: 'self' | 'player' =
    composed.turn.action === 'shoot'
      ? composed.turn.target === 'self'
        ? 'self'
        : 'player'
      : composed.turn.shootTarget === 'self'
        ? 'self'
        : 'player';

  const hud: JevHud = {
    action: composed.action,
    confidence: composed.liveBelief,
    probabilities: composed.nouls,
    nouls: composed.nouls,
    liveBelief: composed.liveBelief,
    shootTarget,
    latencyMs: meta.latencyMs,
    model: meta.model,
    provider: meta.provider,
    fallback: false,
    ruleFired: 'jev',
    policyVersion: JEV_POLICY_VERSION,
  };

  return { ok: true, fallback: false, turn: composed.turn, hud };
}
