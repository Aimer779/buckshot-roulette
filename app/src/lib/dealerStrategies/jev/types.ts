import type { Item } from '@/store/gameStore';
import type { DealerTurnDecision } from '../resolveDealerTurn';

export const JEV_STRATEGY_ID = 'jev';
export const JEV_CONFIDENCE_THRESHOLD = 0.55;

export function clampJevConfidenceMin(value: number): number {
  if (!Number.isFinite(value)) return JEV_CONFIDENCE_THRESHOLD;
  return Math.min(1, Math.max(0, value));
}

export type JevProvider = 'typesafe' | 'openrouter' | 'none';

/** Public dealer state sent to `/api/dealer/jev`. Never includes shell order. */
export interface JevDealerState {
  dealerHP: number;
  playerHP: number;
  dealerMaxHP: number;
  playerMaxHP: number;
  liveCount: number;
  blankCount: number;
  shellsRemaining: number;
  dealerItems: Item[];
  playerItems: Item[];
  dealerSawActive: boolean;
  guillotineTriggered: boolean;
  skipPlayerTurn: boolean;
  currentRound: number;
  /** Maps onto shootT: how live the chamber must look before shooting the player. */
  confidenceMin?: number;
  knownChamber?: 'live' | 'blank' | null;
}

export type JevRuleFired = 'forced' | 'jev' | 'fallback';

export interface JevHud {
  action: string;
  confidence: number;
  probabilities: Record<string, number>;
  nouls: Record<string, number>;
  liveBelief: number;
  shootTarget: 'self' | 'player';
  latencyMs: number;
  model: string;
  provider: JevProvider;
  fallback: boolean;
  reason?: string;
  ruleFired: JevRuleFired;
  policyVersion?: string;
}

export interface JevDealerResponse {
  ok: boolean;
  fallback: boolean;
  turn: DealerTurnDecision;
  hud: JevHud;
}

export interface JevChoiceAnswer {
  type?: 'choice';
  choice?: string;
  confidence?: number;
  probabilities?: Record<string, number>;
}

export interface JevScoreAnswer {
  type?: 'score';
  score?: number;
}

export interface JevNoulAnswer {
  type?: 'noul';
  noul?: number;
}

export interface JevAnswers {
  chamber_likely_live?: JevNoulAnswer;
  should_spend_info?: JevNoulAnswer;
  should_heal?: JevNoulAnswer;
  should_double?: JevNoulAnswer;
  should_deny_turn?: JevNoulAnswer;
  should_invert?: JevNoulAnswer;
  opponent_can_kill_next?: JevNoulAnswer;
  /** @deprecated v2 mixed Choice; ignored by v3 compose. */
  action?: JevChoiceAnswer;
  shoot_target?: JevChoiceAnswer;
  live_belief?: JevScoreAnswer;
}

export const NOUL_LABELS: Record<string, string> = {
  chamber_likely_live: '膛内实弹',
  should_spend_info: '花信息',
  should_heal: '回血',
  should_double: '上手锯',
  should_deny_turn: '上手铐',
  should_invert: '反转',
  opponent_can_kill_next: '对方能杀',
};

export const ACTION_CRITERIA: Record<string, string> = {
  'shoot-self':
    'Current chamber is more likely blank. Shooting self keeps the extra turn if blank.',
  'shoot-player':
    'Current chamber is more likely live. Deal damage to the player and end the turn.',
  'use-handcuffs':
    'Skip the player next turn. Only legal if the dealer holds handcuffs and enough shells remain.',
  'use-cigarette':
    'Heal 1 HP. Illegal if guillotine is on or HP is already full.',
  'use-beer':
    'Eject the chambered shell publicly without firing.',
  'use-handsaw':
    'Next live shot deals 2 damage. Skip if the saw is already active.',
  'use-adrenaline':
    'Steal one player item. The stolen item is not used this turn.',
  'use-medicine':
    '50% heal 2 HP / 50% lose 1 HP. Avoid at 1 HP.',
  'use-inverter':
    'Flip the chambered shell live ↔ blank.',
};

export const ACTION_LABELS: Record<string, string> = {
  'shoot-self': '对自己开枪',
  'shoot-player': '对玩家开枪',
  'use-magnifier': '放大镜',
  'use-handcuffs': '手铐',
  'use-cigarette': '香烟',
  'use-beer': '啤酒',
  'use-handsaw': '手锯',
  'use-adrenaline': '肾上腺素',
  'use-medicine': '过期药品',
  'use-inverter': '逆变器',
  'use-phone': '手机',
};

export const LIVE_BELIEF_LEVELS = [
  'Almost certainly blank',
  'Lean blank',
  'Coin flip',
  'Lean live',
  'Almost certainly live',
] as const;
