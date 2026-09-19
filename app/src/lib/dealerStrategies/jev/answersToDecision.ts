import { balancedStrategy } from '../balancedStrategy';
import { itemIdForAction, legalDealerActions } from '../legalActions';
import {
  resolveDealerTurnDecision,
  type DealerTurnDecision,
} from '../resolveDealerTurn';
import type { DealerContext } from '../types';
import {
  JEV_CONFIDENCE_THRESHOLD,
  type JevAnswers,
  type JevDealerResponse,
  type JevHud,
  type JevProvider,
} from './types';
import { toDealerContextFromJevState } from './buildJevRequest';

export function heuristicShootTarget(ctx: DealerContext): 'self' | 'dealer' {
  const total = ctx.liveCount + ctx.blankCount;
  if (total === 0) return 'dealer';
  return ctx.blankCount / total > 0.5 ? 'self' : 'dealer';
}

function mapShootChoice(choice: string | undefined, ctx: DealerContext): 'self' | 'dealer' {
  if (choice === 'self') return 'self';
  if (choice === 'player') return 'dealer';
  return heuristicShootTarget(ctx);
}

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
  const legal = legalDealerActions(publicCtx);
  const threshold = meta.confidenceMin ?? JEV_CONFIDENCE_THRESHOLD;
  const rawAction = answers?.action?.choice;
  const confidence = answers?.action?.confidence ?? 0;
  const probabilities = answers?.action?.probabilities ?? {};
  const liveBelief = answers?.live_belief?.score ?? 2;
  const shootChoice = answers?.shoot_target?.choice;
  const mappedShoot = mapShootChoice(shootChoice, publicCtx);
  const hudShoot: 'self' | 'player' = mappedShoot === 'self' ? 'self' : 'player';

  const illegal = !rawAction || !legal.includes(rawAction);
  const unconfident = confidence < threshold;
  const useFallback = meta.fallback || illegal || unconfident;

  const hud: JevHud = {
    action: useFallback
      ? (rawAction && legal.includes(rawAction) ? rawAction : 'fallback')
      : rawAction,
    confidence,
    probabilities,
    liveBelief,
    shootTarget: hudShoot,
    latencyMs: meta.latencyMs,
    model: meta.model,
    provider: meta.provider,
    fallback: useFallback,
    reason: useFallback
      ? meta.reason ?? (illegal ? 'illegal-action' : unconfident ? 'low-confidence' : 'fallback')
      : undefined,
  };

  if (useFallback) {
    return { ok: false, fallback: true, turn: fallbackTurn(publicCtx), hud };
  }

  let turn: DealerTurnDecision;
  if (rawAction === 'shoot-self') {
    turn = { action: 'shoot', target: 'self' };
  } else if (rawAction === 'shoot-player') {
    turn = { action: 'shoot', target: 'dealer' };
  } else {
    const itemId = itemIdForAction(publicCtx, rawAction);
    if (!itemId) {
      return {
        ok: false,
        fallback: true,
        turn: fallbackTurn(publicCtx),
        hud: { ...hud, fallback: true, reason: 'missing-item' },
      };
    }
    turn = { action: 'use-item', itemId, shootTarget: mappedShoot };
  }

  return { ok: true, fallback: false, turn, hud };
}
