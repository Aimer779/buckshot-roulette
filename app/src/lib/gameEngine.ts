import type { Shell, Item, ItemType } from '@/store/gameStore';
import { makeItem } from '@/lib/itemFactory';
import { ROUND_CONFIG } from '@/data/roundConfig';
import { balancedStrategy } from '@/lib/dealerStrategies';

// ─── Shell Loading ───────────────────────────────────────

/**
 * Generate a realistic shell configuration for a round.
 * Always at least 1 live and 1 blank.
 */
export function loadShells(round: number): Shell[] {
  const config = ROUND_CONFIG[round] || ROUND_CONFIG[3];
  const count = config.shellCount;

  // Ensure at least 1 live and 1 blank
  const liveCount = Math.max(1, Math.floor(count * (0.4 + Math.random() * 0.2)));
  const blankCount = Math.max(1, count - liveCount);

  const shells: Shell[] = [
    ...Array.from({ length: liveCount }, () => ({ type: 'live' as const, revealed: false })),
    ...Array.from({ length: blankCount }, () => ({ type: 'blank' as const, revealed: false })),
  ];

  // Fisher-Yates shuffle
  for (let i = shells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shells[i], shells[j]] = [shells[j], shells[i]];
  }

  return shells;
}

// ─── Damage Calculation ──────────────────────────────────

/**
 * Calculate damage for a shot.
 * Returns 1 normally, 2 if saw is active.
 */
export function calculateDamage(hasSaw: boolean): number {
  return hasSaw ? 2 : 1;
}

// ─── Item Distribution ───────────────────────────────────

const PLAYER_ITEM_POOL: ItemType[] = [
  'magnifier',
  'handcuffs',
  'cigarette',
  'beer',
  'handsaw',
  'adrenaline',
  'medicine',
  'inverter',
  'phone',
];

const DEALER_ITEM_POOL: ItemType[] = [
  'handcuffs',
  'cigarette',
  'beer',
  'handsaw',
  'adrenaline',
  'medicine',
  'inverter',
  'phone',
];

/**
 * Get random items for a round.
 * Items may repeat. Dealer does not receive magnifier until AI can use private info.
 */
export function distributeItems(round: number): { player: Item[]; dealer: Item[] } {
  const config = ROUND_CONFIG[round] || ROUND_CONFIG[3];
  const count = config.itemCount;

  const player: Item[] = [];
  const dealer: Item[] = [];

  for (let i = 0; i < count; i++) {
    const playerType = PLAYER_ITEM_POOL[Math.floor(Math.random() * PLAYER_ITEM_POOL.length)];
    const dealerType = DEALER_ITEM_POOL[Math.floor(Math.random() * DEALER_ITEM_POOL.length)];
    player.push(makeItem(playerType));
    dealer.push(makeItem(dealerType));
  }

  return { player, dealer };
}

// ─── Dealer AI ───────────────────────────────────────────

export interface DealerDecision {
  action: 'shoot-self' | 'shoot-player' | 'use-item';
  itemId?: string;
  reasoning: string;
}

/**
 * @deprecated Use the {@link DealerStrategy} abstraction in
 * `app/src/lib/dealerStrategies` instead. This function is kept as a thin
 * compatibility wrapper around the default balanced strategy.
 */
export function dealerDecision(
  dealerHP: number,
  _playerHP: number,
  liveCount: number,
  blankCount: number,
  shellsRemaining: number,
  dealerMaxHP: number,
  dealerItems: Item[],
  dealerSawActive: boolean,
  guillotineTriggered: boolean
): DealerDecision {
  return balancedStrategy.decide({
    dealerHP,
    playerHP: _playerHP,
    dealerMaxHP,
    liveCount,
    blankCount,
    shellsRemaining,
    dealerItems,
    dealerSawActive,
    guillotineTriggered,
  });
}

// ─── Round helpers ───────────────────────────────────────

/**
 * Check if the game should end or advance to the next round.
 * In rounds 1 and 2, reducing the opponent to 0 HP wins the round, not the match.
 */
export function checkGameOver(
  playerHP: number,
  dealerHP: number,
  currentRound: number,
  maxRounds: number
): 'player' | 'dealer' | 'round-won' | 'round-lost' | 'continue' {
  if (playerHP <= 0) {
    // Player loses the round; final round failure ends the game
    return currentRound >= maxRounds ? 'dealer' : 'round-lost';
  }
  if (dealerHP <= 0) {
    // Player wins the round; final round victory ends the game
    return currentRound >= maxRounds ? 'player' : 'round-won';
  }
  return 'continue';
}
