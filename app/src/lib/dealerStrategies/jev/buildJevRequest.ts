import type { DealerContext } from '../types';
import { legalDealerActions } from '../legalActions';
import { ACTION_CRITERIA, LIVE_BELIEF_LEVELS } from './types';

export function toDealerContextFromJevState(ctx: DealerContext): DealerContext {
  return {
    dealerHP: ctx.dealerHP,
    playerHP: ctx.playerHP,
    dealerMaxHP: ctx.dealerMaxHP,
    liveCount: ctx.liveCount,
    blankCount: ctx.blankCount,
    shellsRemaining: ctx.shellsRemaining,
    dealerItems: ctx.dealerItems,
    dealerSawActive: ctx.dealerSawActive,
    guillotineTriggered: ctx.guillotineTriggered,
    playerItems: ctx.playerItems ?? [],
    playerMaxHP: ctx.playerMaxHP,
    skipPlayerTurn: ctx.skipPlayerTurn === true,
    currentRound: ctx.currentRound,
  };
}

export function buildJevRequest(ctx: DealerContext, model: string) {
  const publicCtx = toDealerContextFromJevState(ctx);
  const legal = legalDealerActions(publicCtx);
  const criteria: Record<string, string> = {};
  for (const action of legal) {
    criteria[action] = ACTION_CRITERIA[action] ?? action;
  }

  return {
    model,
    state: {
      rules:
        'Buckshot Roulette dealer turn. Public shell counts only. Never assume the hidden order.',
      round: publicCtx.currentRound ?? 1,
      guillotineTriggered: publicCtx.guillotineTriggered,
      dealerHP: publicCtx.dealerHP,
      dealerMaxHP: publicCtx.dealerMaxHP,
      playerHP: publicCtx.playerHP,
      playerMaxHP: publicCtx.playerMaxHP ?? publicCtx.dealerMaxHP,
      liveCount: publicCtx.liveCount,
      blankCount: publicCtx.blankCount,
      shellsRemaining: publicCtx.shellsRemaining,
      dealerItems: publicCtx.dealerItems.map((item) => item.type),
      playerItems: (publicCtx.playerItems ?? []).map((item) => item.type),
      dealerSawActive: publicCtx.dealerSawActive,
      playerCuffed: publicCtx.skipPlayerTurn === true,
      legalActions: legal,
    },
    questions: {
      action: {
        type: 'choice' as const,
        instructions:
          'Pick exactly one action from `legalActions`. Do not invent an action that is not listed.',
        criteria,
      },
      shoot_target: {
        type: 'choice' as const,
        instructions:
          'If this turn uses an item first, who should the dealer shoot afterwards? Independent of the action choice.',
        criteria: {
          self: 'Shoot self. Prefer when the chamber is more likely blank, to keep the extra turn if blank.',
          player:
            'Shoot the player. Prefer when the chamber is more likely live.',
        },
      },
      live_belief: {
        type: 'score' as const,
        instructions:
          'Given only liveCount and blankCount, how likely is the current chamber live?',
        criteria: [...LIVE_BELIEF_LEVELS],
      },
    },
  };
}
