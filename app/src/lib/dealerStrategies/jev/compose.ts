import { itemIdForAction, legalDealerActions } from '../legalActions';
import type { DealerTurnDecision } from '../resolveDealerTurn';
import type { DealerContext } from '../types';
import { buildJevFacts } from './facts';
import { JEV_THRESHOLDS } from './policy';
import type { JevAnswers } from './types';

function noulOf(answers: JevAnswers | null | undefined, key: keyof JevAnswers, fallback = 0): number {
  const value = answers?.[key];
  if (value && 'noul' in value && typeof value.noul === 'number' && Number.isFinite(value.noul)) {
    return value.noul;
  }
  return fallback;
}

function collectNouls(answers: JevAnswers | null | undefined, liveFallback: number): Record<string, number> {
  const keys: (keyof JevAnswers)[] = [
    'chamber_likely_live',
    'should_spend_info',
    'should_heal',
    'should_double',
    'should_deny_turn',
    'should_invert',
    'opponent_can_kill_next',
  ];
  const out: Record<string, number> = {};
  for (const key of keys) {
    const fallback = key === 'chamber_likely_live' ? liveFallback : 0;
    const value = noulOf(answers, key, fallback);
    if (answers?.[key] || key === 'chamber_likely_live') out[key] = value;
  }
  return out;
}

function itemTurn(
  ctx: DealerContext,
  legal: Set<string>,
  action: string,
  shootTarget: 'self' | 'dealer'
): DealerTurnDecision | null {
  if (!legal.has(action)) return null;
  const itemId = itemIdForAction(ctx, action);
  if (!itemId) return null;
  return { action: 'use-item', itemId, shootTarget };
}

export function composeJevTurn(
  ctx: DealerContext,
  answers: JevAnswers | null | undefined,
  shootT: number
): {
  turn: DealerTurnDecision;
  action: string;
  nouls: Record<string, number>;
  liveBelief: number;
} {
  const facts = buildJevFacts(ctx);
  const legal = new Set(legalDealerActions(ctx));
  const liveBelief = noulOf(answers, 'chamber_likely_live', facts.liveRatio);
  const nouls = collectNouls(answers, facts.liveRatio);
  const shootTarget: 'self' | 'dealer' = liveBelief >= shootT ? 'dealer' : 'self';

  const tryUse = (action: string, ok: boolean) =>
    ok ? itemTurn(ctx, legal, action, shootTarget) : null;

  const pack = (action: string, turn: DealerTurnDecision) => ({
    turn,
    action,
    nouls,
    liveBelief,
  });

  const heal = tryUse('use-cigarette', nouls.should_heal > JEV_THRESHOLDS.heal && facts.healLegal);
  if (heal) return pack('use-cigarette', heal);

  if (nouls.should_spend_info > JEV_THRESHOLDS.info) {
    const mag = tryUse('use-magnifier', true);
    if (mag) return pack('use-magnifier', mag);
    const beer = tryUse('use-beer', true);
    if (beer) return pack('use-beer', beer);
  }

  if (nouls.opponent_can_kill_next > JEV_THRESHOLDS.opponentCanKill) {
    const cuffs = tryUse('use-handcuffs', nouls.should_deny_turn > JEV_THRESHOLDS.cuff);
    if (cuffs) return pack('use-handcuffs', cuffs);
  }

  const saw = tryUse(
    'use-handsaw',
    nouls.should_double > JEV_THRESHOLDS.saw && liveBelief > JEV_THRESHOLDS.chamberLiveForSaw
  );
  if (saw) return pack('use-handsaw', saw);

  const cuffs = tryUse('use-handcuffs', nouls.should_deny_turn > JEV_THRESHOLDS.cuff);
  if (cuffs) return pack('use-handcuffs', cuffs);

  const invert = tryUse('use-inverter', nouls.should_invert > JEV_THRESHOLDS.invert);
  if (invert) return pack('use-inverter', invert);

  if (shootTarget === 'self') {
    return pack('shoot-self', { action: 'shoot', target: 'self' });
  }
  return pack('shoot-player', { action: 'shoot', target: 'dealer' });
}
