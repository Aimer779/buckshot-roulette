import type { DealerContext } from '../types';
import { legalDealerActions } from '../legalActions';
import { buildJevFacts } from './facts';

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
    playerSawActive: ctx.playerSawActive === true,
    guillotineTriggered: ctx.guillotineTriggered,
    playerItems: ctx.playerItems ?? [],
    playerMaxHP: ctx.playerMaxHP,
    skipPlayerTurn: ctx.skipPlayerTurn === true,
    currentRound: ctx.currentRound,
    knownChamber: ctx.knownChamber ?? null,
  };
}

function noul(instructions: string) {
  return { type: 'noul' as const, instructions };
}

export function buildJevRequest(ctx: DealerContext, model: string) {
  const publicCtx = toDealerContextFromJevState(ctx);
  const facts = buildJevFacts(publicCtx);
  const legal = legalDealerActions(publicCtx);

  const questions: Record<string, { type: 'noul'; instructions: string }> = {
    chamber_likely_live: noul(
      'Given only `facts.liveRatio` and `facts.knownChamber`, is the chambered shell live? Do not recount liveCount/blankCount.'
    ),
    opponent_can_kill_next: noul(
      'If the opponent gets the next turn, can they realistically finish this side this load? Use `facts.lethalIfLive` and remaining items.'
    ),
  };

  if (facts.healLegal) {
    questions.should_heal = noul(
      'Should the acting side heal this turn? `facts.healLegal` is true. Full HP or guillotine means no.'
    );
  }
  if (facts.infoItemsLeft > 0 && facts.knownChamber === null) {
    questions.should_spend_info = noul(
      'Is it worth spending a magnifier or beer before shooting? Chamber is unknown and several shells may remain.'
    );
  }
  if (facts.sawLegal) {
    questions.should_double = noul(
      'Should the handsaw be used before the next shot? Only useful if the chamber is likely live (`facts.liveRatio`).'
    );
  }
  if (facts.cuffLegal) {
    questions.should_deny_turn = noul(
      'Is skipping the opponent next turn worth a handcuff now? Stronger if `facts.opponent` could punish.'
    );
  }
  if (facts.invertLegal && facts.knownChamber === null) {
    questions.should_invert = noul(
      'Is flipping the unknown chambered shell better than shooting it as-is?'
    );
  }

  return {
    model,
    state: {
      rules:
        'Buckshot Roulette dealer turn. Public counts plus dealer-private knownChamber. Never assume hidden order. Ratios are precomputed; do not do arithmetic.',
      facts,
      dealerItems: publicCtx.dealerItems.map((item) => item.type),
      playerItems: (publicCtx.playerItems ?? []).map((item) => item.type),
      legalActions: legal,
    },
    questions,
  };
}
