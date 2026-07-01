import type { Item, ItemType, Shell } from '@/store/gameStore';

export type ItemActor = 'player' | 'dealer';

/**
 * Item types dealerDecision may select (gameEngine dealerDecision item priorities).
 * Keep in sync when batch 8 extends dealer AI.
 */
export const DEALER_AI_ITEM_TYPES = [
  'cigarette',
  'magnifier',
  'handcuffs',
  'handsaw',
  'phone',
] as const satisfies readonly ItemType[];

/** Item types with full dealer rules in executeItemEffect. */
export const DEALER_EFFECTIVE_ITEM_TYPES = [
  'cigarette',
  'handsaw',
  'handcuffs',
  'beer',
  'magnifier',
] as const satisfies readonly ItemType[];

/**
 * Player-only items. dealerDecision never selects these; executeItemEffect returns
 * null for dealer so inventory is not silently burned if AI starts using them later.
 */
export const DEALER_PLAYER_ONLY_ITEM_TYPES = [
  'adrenaline',
  'medicine',
  'inverter',
] as const satisfies readonly ItemType[];

export interface ItemEffectContext {
  actor: ItemActor;
  item: Item;
  playerHP: number;
  playerMaxHP: number;
  dealerHP: number;
  dealerMaxHP: number;
  shells: Shell[];
  currentShellIndex: number;
  currentShell: Shell | null;
  sawActive: boolean;
  guillotineTriggered: boolean;
  opponentItems: Item[];
}

export interface ItemEffectResult {
  consumedItemIds: string[];
  addedItems?: Item[];
  removedOpponentItemIds?: string[];
  hpChanges?: Array<{
    target: 'player' | 'dealer';
    amount: number;
    kind: 'damage' | 'heal';
  }>;
  shellUpdates?: Shell[];
  consumeCurrentShell?: boolean;
  revealedShellIndices?: number[];
  sawActive?: boolean;
  skipDealerTurn?: boolean;
  log?: {
    message: string;
    type: 'info' | 'damage' | 'heal' | 'item' | 'system';
  };
  sfx?: string;
  uiEffect?: ItemType;
  showRevealedShellAt?: number;
  triggerBloodFlashOnDamage?: boolean;
  showDamageText?: { text: string; target: 'player' | 'dealer' };
  scheduleReloadAfterEject?: boolean;
  ejectedShellType?: 'live' | 'blank';
}

/**
 * Pure item-effect rule executor. Returns null when the item cannot be used
 * (blocked, no-op, or invalid target). Does not touch store or React state.
 *
 * Replaces inline switch statements in GameplayScreen; wraps the intent of
 * gameEngine.resolveItemUse without adopting its narrower ItemEffect shape.
 *
 * Dealer contract: cigarette/handsaw/handcuffs/beer/magnifier have real rules.
 * phone is selected by dealer AI but intentionally noop (consume + sfx only),
 * matching the old executeDealerItemUse default branch. Player-only types return
 * null for dealer so a future AI change cannot silently waste them.
 */
export function executeItemEffect(ctx: ItemEffectContext): ItemEffectResult | null {
  const { actor, item } = ctx;

  if (
    actor === 'dealer' &&
    (DEALER_PLAYER_ONLY_ITEM_TYPES as readonly ItemType[]).includes(item.type)
  ) {
    return null;
  }
  const ownerHP = actor === 'player' ? ctx.playerHP : ctx.dealerHP;
  const ownerMaxHP = actor === 'player' ? ctx.playerMaxHP : ctx.dealerMaxHP;

  switch (item.type) {
    case 'cigarette': {
      if (actor === 'player' && ctx.guillotineTriggered) return null;
      if (ownerHP >= ownerMaxHP) return null;
      return {
        consumedItemIds: [item.id],
        hpChanges: [{ target: actor, amount: 1, kind: 'heal' }],
        sfx: 'item-use',
        uiEffect: actor === 'player' ? 'cigarette' : undefined,
        log:
          actor === 'dealer'
            ? { message: '庄家使用了香烟', type: 'item' }
            : undefined,
      };
    }

    case 'handsaw': {
      if (ctx.sawActive) return null;
      return {
        consumedItemIds: [item.id],
        sawActive: true,
        sfx: 'saw',
        uiEffect: actor === 'player' ? 'handsaw' : undefined,
        log: {
          message:
            actor === 'player'
              ? '手锯已装备，下一发伤害翻倍'
              : '庄家使用了手锯，下一发伤害翻倍',
          type: 'item',
        },
      };
    }

    case 'handcuffs':
      return {
        consumedItemIds: [item.id],
        skipDealerTurn: true,
        sfx: 'metal-clank',
        uiEffect: actor === 'player' ? 'handcuffs' : undefined,
        log: {
          message:
            actor === 'player'
              ? '手铐已使用，庄家下回合被跳过'
              : '庄家使用了手铐',
          type: 'item',
        },
      };

    case 'beer': {
      const shell = ctx.currentShell;
      if (!shell) return null;
      const st = shell.type;
      return {
        consumedItemIds: [item.id],
        consumeCurrentShell: true,
        ejectedShellType: st,
        sfx: 'glass-break',
        uiEffect: actor === 'player' ? 'beer' : undefined,
        log: {
          message:
            actor === 'player'
              ? `啤酒弹出了${st === 'live' ? '实弹' : '空包弹'}`
              : `庄家啤酒弹出了${st === 'live' ? '实弹' : '空包弹'}`,
          type: 'item',
        },
        scheduleReloadAfterEject: actor === 'player',
      };
    }

    case 'magnifier': {
      const shell = ctx.currentShell;
      if (!shell) return null;
      return {
        consumedItemIds: [item.id],
        revealedShellIndices: [ctx.currentShellIndex],
        sfx: 'item-use',
        showRevealedShellAt: actor === 'player' ? ctx.currentShellIndex : undefined,
        log: {
          message:
            actor === 'player'
              ? `当前子弹: ${shell.type === 'live' ? '实弹' : '空包弹'}`
              : '庄家查看了子弹',
          type: 'item',
        },
      };
    }

    case 'adrenaline': {
      if (ctx.opponentItems.length === 0) return null;
      const randomIdx = Math.floor(Math.random() * ctx.opponentItems.length);
      const stolen = ctx.opponentItems[randomIdx];
      if (!stolen) return null;
      return {
        consumedItemIds: [item.id],
        removedOpponentItemIds: [stolen.id],
        addedItems: [stolen],
        sfx: 'item-use',
        uiEffect: 'adrenaline',
        log: { message: '偷取了庄家的道具', type: 'item' },
      };
    }

    case 'medicine': {
      if (ctx.guillotineTriggered) return null;
      const roll = Math.random();
      if (roll < 0.5) {
        return {
          consumedItemIds: [item.id],
          hpChanges: [{ target: 'player', amount: 2, kind: 'heal' }],
          sfx: 'item-use',
          uiEffect: 'medicine',
          log: { message: '过期药品生效，恢复 2 点生命', type: 'heal' },
        };
      }
      return {
        consumedItemIds: [item.id],
        hpChanges: [{ target: 'player', amount: 1, kind: 'damage' }],
        sfx: 'item-use',
        uiEffect: 'medicine',
        triggerBloodFlashOnDamage: true,
        showDamageText: { text: '-1', target: 'player' },
        log: { message: '过期药品失效，失去 1 点生命', type: 'damage' },
      };
    }

    case 'inverter': {
      const curShell = ctx.currentShell;
      if (!curShell) return null;
      const newType = curShell.type === 'live' ? 'blank' : 'live';
      return {
        consumedItemIds: [item.id],
        shellUpdates: ctx.shells.map((sh, i) =>
          i === ctx.currentShellIndex ? { ...sh, type: newType } : sh
        ),
        sfx: 'item-use',
        uiEffect: 'inverter',
        log: { message: '逆变器翻转了子弹类型', type: 'item' },
      };
    }

    case 'phone': {
      // Dealer AI may select phone (dealerDecision) but has no reveal logic yet;
      // consume + sfx matches old executeDealerItemUse default behavior.
      if (actor !== 'player') {
        return { consumedItemIds: [item.id], sfx: 'item-use' };
      }
      const futureIndices: number[] = [];
      for (let i = ctx.currentShellIndex + 1; i < ctx.shells.length; i++) {
        if (!ctx.shells[i].revealed) {
          futureIndices.push(i);
        }
      }
      const result: ItemEffectResult = {
        consumedItemIds: [item.id],
        sfx: 'phone-ring',
        uiEffect: 'phone',
      };
      if (futureIndices.length > 0) {
        const ri = futureIndices[Math.floor(Math.random() * futureIndices.length)];
        result.revealedShellIndices = [ri];
        result.log = {
          message: `手机揭示了第 ${ri - ctx.currentShellIndex} 发子弹`,
          type: 'item',
        };
      }
      return result;
    }

    default:
      if (actor === 'dealer') {
        return { consumedItemIds: [item.id], sfx: 'item-use' };
      }
      return null;
  }
}