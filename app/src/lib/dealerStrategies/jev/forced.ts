import { itemIdForAction, legalDealerActions } from '../legalActions';
import type { DealerContext } from '../types';
import type { DealerTurnDecision } from '../resolveDealerTurn';
import { inferredKnownChamber } from './facts';
import { JEV_POLICY_VERSION } from './policy';
import type { JevDealerResponse } from './types';

function pack(
  ctx: DealerContext,
  action: string,
  turn: DealerTurnDecision,
  reason: string
): JevDealerResponse {
  return {
    ok: true,
    fallback: false,
    turn,
    hud: {
      action,
      confidence: 1,
      probabilities: {},
      nouls: {},
      liveBelief: inferredKnownChamber(ctx) === 'live' ? 1 : inferredKnownChamber(ctx) === 'blank' ? 0 : 0.5,
      shootTarget: turn.action === 'shoot' ? (turn.target === 'self' ? 'self' : 'player') : turn.shootTarget === 'self' ? 'self' : 'player',
      latencyMs: 0,
      model: 'forced',
      provider: 'none',
      fallback: false,
      reason,
      ruleFired: 'forced',
      policyVersion: JEV_POLICY_VERSION,
    },
  };
}

/**
 * Closed-form turns. Jev is not asked: known chamber, all-live, all-blank, last determined shell.
 */
export function resolveForcedDealerTurn(ctx: DealerContext): JevDealerResponse | null {
  const known = inferredKnownChamber(ctx);
  if (!known) return null;

  const legal = new Set(legalDealerActions(ctx));

  if (known === 'blank') {
    return pack(ctx, 'shoot-self', { action: 'shoot', target: 'self' }, 'known-blank');
  }

  // Known live. Cuffing first is strictly better if a return live shot would kill us.
  const oppHasSaw =
    ctx.playerSawActive === true ||
    (ctx.playerItems ?? []).some((item) => item.type === 'handsaw');
  const theyKillIfLive = ctx.dealerHP <= (oppHasSaw ? 2 : 1);
  if (legal.has('use-handcuffs') && theyKillIfLive) {
    const itemId = itemIdForAction(ctx, 'use-handcuffs');
    if (itemId) {
      return pack(
        ctx,
        'use-handcuffs',
        { action: 'use-item', itemId, shootTarget: 'dealer' },
        'known-live-cuff'
      );
    }
  }

  // Saw is wasted if 1 damage already kills.
  if (legal.has('use-handsaw') && ctx.playerHP > 1) {
    const itemId = itemIdForAction(ctx, 'use-handsaw');
    if (itemId) {
      return pack(
        ctx,
        'use-handsaw',
        { action: 'use-item', itemId, shootTarget: 'dealer' },
        'known-live-saw'
      );
    }
  }

  return pack(ctx, 'shoot-player', { action: 'shoot', target: 'dealer' }, 'known-live');
}
