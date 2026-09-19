import { balancedStrategy } from '../balancedStrategy';
import { resolveDealerTurnDecision } from '../resolveDealerTurn';
import {
  clampJevConfidenceMin,
  JEV_CONFIDENCE_THRESHOLD,
  type JevDealerResponse,
  type JevDealerState,
} from './types';
import { toDealerContextFromJevState } from './buildJevRequest';

export function toJevRequestBody(state: JevDealerState): JevDealerState {
  return {
    dealerHP: state.dealerHP,
    playerHP: state.playerHP,
    dealerMaxHP: state.dealerMaxHP,
    playerMaxHP: state.playerMaxHP,
    liveCount: state.liveCount,
    blankCount: state.blankCount,
    shellsRemaining: state.shellsRemaining,
    dealerItems: state.dealerItems.map((item) => ({ id: item.id, type: item.type })),
    playerItems: state.playerItems.map((item) => ({ id: item.id, type: item.type })),
    dealerSawActive: state.dealerSawActive,
    guillotineTriggered: state.guillotineTriggered,
    skipPlayerTurn: state.skipPlayerTurn,
    currentRound: state.currentRound,
    confidenceMin: clampJevConfidenceMin(state.confidenceMin ?? JEV_CONFIDENCE_THRESHOLD),
    knownChamber: state.knownChamber ?? null,
    playerSawActive: state.playerSawActive === true,
    ...(state.turnId ? { turnId: state.turnId } : {}),
  };
}

export function localJevFallback(state: JevDealerState, reason: string): JevDealerResponse {
  const ctx = toDealerContextFromJevState(state);
  return {
    ok: false,
    fallback: true,
    turn: resolveDealerTurnDecision(balancedStrategy, ctx),
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
      reason,
      ruleFired: 'fallback',
    },
  };
}

export async function fetchJevDealerTurn(
  state: JevDealerState,
  signal?: AbortSignal
): Promise<JevDealerResponse> {
  const res = await fetch('/api/dealer/jev', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toJevRequestBody(state)),
    signal,
  });
  if (!res.ok) throw new Error(`jev-http-${res.status}`);
  const json = (await res.json()) as JevDealerResponse;
  if (!json?.turn) throw new Error('jev-malformed');
  return json;
}
