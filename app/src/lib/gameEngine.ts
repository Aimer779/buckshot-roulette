import type { Shell, Item, ItemType } from '@/store/gameStore';
import { makeItem, ROUND_CONFIG } from '@/store/gameStore';

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

/**
 * Get the count of live shells remaining (including unrevealed)
 */
export function getLiveShellCount(shells: Shell[], fromIndex: number): number {
  return shells.slice(fromIndex).filter((s) => s.type === 'live').length;
}

/**
 * Get the count of blank shells remaining (including unrevealed)
 */
export function getBlankShellCount(shells: Shell[], fromIndex: number): number {
  return shells.slice(fromIndex).filter((s) => s.type === 'blank').length;
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

const ITEM_POOL: ItemType[] = [
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

/**
 * Get random items for a round.
 * Items may repeat.
 */
export function distributeItems(round: number): { player: Item[]; dealer: Item[] } {
  const config = ROUND_CONFIG[round] || ROUND_CONFIG[3];
  const count = config.itemCount;

  const player: Item[] = [];
  const dealer: Item[] = [];

  for (let i = 0; i < count; i++) {
    const playerType = ITEM_POOL[Math.floor(Math.random() * ITEM_POOL.length)];
    const dealerType = ITEM_POOL[Math.floor(Math.random() * ITEM_POOL.length)];
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
 * Dealer AI decision logic.
 * The dealer follows shell ratio awareness:
 * - If more blanks than live: likely to shoot self
 * - If more live than blanks: likely to shoot player
 * - With saw: more aggressive
 * - Low HP: more cautious, prioritize healing items
 */
export function dealerDecision(
  dealerHP: number,
  _playerHP: number,
  liveCount: number,
  blankCount: number,
  shellsRemaining: number,
  dealerItems: Item[],
  sawActive: boolean
): DealerDecision {
  const total = liveCount + blankCount;
  if (total === 0) {
    return { action: 'shoot-player', reasoning: 'No shells remaining' };
  }

  const liveRatio = liveCount / total;
  const blankRatio = blankCount / total;

  // ── Item usage priorities ────────────────────────────

  // 1. Use cigarette if HP is low (below 50%)
  const maxHP = dealerHP <= 2 ? 2 : dealerHP <= 4 ? 4 : 6;
  if (dealerHP <= Math.ceil(maxHP / 2)) {
    const cig = dealerItems.find((i) => i.type === 'cigarette');
    if (cig) {
      return { action: 'use-item', itemId: cig.id, reasoning: 'HP low, use cigarette' };
    }
  }

  // 2. Use magnifier if available and shells remain
  if (shellsRemaining > 1) {
    const mag = dealerItems.find((i) => i.type === 'magnifier');
    if (mag) {
      return { action: 'use-item', itemId: mag.id, reasoning: 'Check shell with magnifier' };
    }
  }

  // 3. Use handcuffs if available
  const cuffs = dealerItems.find((i) => i.type === 'handcuffs');
  if (cuffs && shellsRemaining > 2) {
    return { action: 'use-item', itemId: cuffs.id, reasoning: 'Restrict player turn' };
  }

  // 4. Use handsaw if live ratio is high
  if (!sawActive && liveRatio > 0.5) {
    const saw = dealerItems.find((i) => i.type === 'handsaw');
    if (saw) {
      return { action: 'use-item', itemId: saw.id, reasoning: 'High live ratio, prepare saw' };
    }
  }

  // 5. Use phone to gather intel
  const phone = dealerItems.find((i) => i.type === 'phone');
  if (phone && shellsRemaining > 2) {
    return { action: 'use-item', itemId: phone.id, reasoning: 'Gather intel with phone' };
  }

  // ── Shooting decision ────────────────────────────────

  // If blank ratio is significantly higher, shoot self
  if (blankRatio > liveRatio + 0.15) {
    return { action: 'shoot-self', reasoning: 'More blanks likely, shoot self' };
  }

  // If live ratio is higher, shoot player
  if (liveRatio > blankRatio + 0.15) {
    return { action: 'shoot-player', reasoning: 'More live shells, shoot player' };
  }

  // Close call: use randomness with slight bias
  // Dealer slightly prefers shooting player when uncertain
  const random = Math.random();
  if (random < 0.45) {
    return { action: 'shoot-self', reasoning: 'Uncertain, taking risk on self' };
  }
  return { action: 'shoot-player', reasoning: 'Uncertain, shooting player' };
}

// ─── Item Effect Resolvers ───────────────────────────────

export interface ItemEffect {
  type: 'reveal-shell' | 'heal' | 'damage' | 'skip-turn' | 'eject-shell' | 'double-damage' | 'steal-item' | 'invert-shell' | 'reveal-random';
  value?: number;
  target?: 'player' | 'dealer';
  message: string;
}

export function resolveItemUse(itemType: ItemType, context: {
  currentShell: Shell | null;
  shells: Shell[];
  currentIndex: number;
  targetItems: Item[];
}): ItemEffect {
  switch (itemType) {
    case 'magnifier':
      return {
        type: 'reveal-shell',
        message: context.currentShell
          ? `当前子弹: ${context.currentShell.type === 'live' ? '实弹' : '空包弹'}`
          : '枪膛为空',
      };

    case 'cigarette':
      return {
        type: 'heal',
        value: 1,
        target: 'player',
        message: '恢复 1 点生命值',
      };

    case 'handcuffs':
      return {
        type: 'skip-turn',
        message: '对方下一回合被跳过',
      };

    case 'beer':
      return {
        type: 'eject-shell',
        message: context.currentShell
          ? `弹出了${context.currentShell.type === 'live' ? '实弹' : '空包弹'}`
          : '枪膛为空',
      };

    case 'handsaw':
      return {
        type: 'double-damage',
        message: '下一发伤害翻倍',
      };

    case 'adrenaline':
      return {
        type: 'steal-item',
        message: '偷取对方一个道具',
      };

    case 'medicine':
      {
        const roll = Math.random();
        if (roll < 0.5) {
          return {
            type: 'heal',
            value: 2,
            target: 'player',
            message: '过期药品生效，恢复 2 点生命值',
          };
        } else {
          return {
            type: 'damage',
            value: 1,
            target: 'player',
            message: '过期药品失效，失去 1 点生命值',
          };
        }
      }

    case 'inverter':
      return {
        type: 'invert-shell',
        message: '子弹类型已翻转',
      };

    case 'phone':
      return {
        type: 'reveal-random',
        message: '获得了神秘提示...',
      };

    default:
      return {
        type: 'reveal-shell',
        message: '道具使用无效',
      };
  }
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
