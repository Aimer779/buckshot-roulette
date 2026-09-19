import type { DealerContext } from '../types';

export type KnownChamber = 'live' | 'blank';

export interface JevFacts {
  liveCount: number;
  blankCount: number;
  shellsRemaining: number;
  liveRatio: number;
  blankRatio: number;
  knownChamber: KnownChamber | null;
  lethalIfLive: boolean;
  selfDiesIfLive: boolean;
  extraTurnValue: boolean;
  infoItemsLeft: number;
  healLegal: boolean;
  sawLegal: boolean;
  cuffLegal: boolean;
  invertLegal: boolean;
  magnifierLegal: boolean;
}

export function inferredKnownChamber(ctx: DealerContext): KnownChamber | null {
  if (ctx.knownChamber === 'live' || ctx.knownChamber === 'blank') return ctx.knownChamber;
  if (ctx.blankCount <= 0 && ctx.liveCount > 0) return 'live';
  if (ctx.liveCount <= 0 && ctx.blankCount > 0) return 'blank';
  return null;
}

export function buildJevFacts(ctx: DealerContext): JevFacts {
  const total = ctx.liveCount + ctx.blankCount;
  const liveRatio = total > 0 ? ctx.liveCount / total : 0;
  const blankRatio = total > 0 ? ctx.blankCount / total : 0;
  const knownChamber = inferredKnownChamber(ctx);
  const types = new Set(ctx.dealerItems.map((item) => item.type));
  const sawDamage = ctx.dealerSawActive ? 2 : 1;
  const playerCuffed = ctx.skipPlayerTurn === true;
  const healLegal =
    types.has('cigarette') && !ctx.guillotineTriggered && ctx.dealerHP < ctx.dealerMaxHP;
  const sawLegal = types.has('handsaw') && !ctx.dealerSawActive;
  const cuffLegal = types.has('handcuffs') && !playerCuffed && ctx.shellsRemaining > 2;
  const invertLegal = types.has('inverter') && ctx.shellsRemaining > 0;
  const magnifierLegal = types.has('magnifier') && knownChamber === null && ctx.shellsRemaining > 0;
  const beerLegal = types.has('beer') && ctx.shellsRemaining > 0;
  const infoItemsLeft = (magnifierLegal ? 1 : 0) + (beerLegal ? 1 : 0);

  return {
    liveCount: ctx.liveCount,
    blankCount: ctx.blankCount,
    shellsRemaining: ctx.shellsRemaining,
    liveRatio,
    blankRatio,
    knownChamber,
    lethalIfLive: ctx.playerHP <= sawDamage,
    selfDiesIfLive: ctx.dealerHP <= sawDamage,
    extraTurnValue: infoItemsLeft >= 1 || cuffLegal || types.size >= 2,
    infoItemsLeft,
    healLegal,
    sawLegal,
    cuffLegal,
    invertLegal,
    magnifierLegal,
  };
}
