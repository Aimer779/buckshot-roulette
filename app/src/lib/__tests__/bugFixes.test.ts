import { describe, it, expect, beforeEach } from 'vitest';
import {
  executeItemEffect,
  type ItemEffectContext,
} from '@/lib/itemEffects';
import { dealerDecision } from '@/lib/gameEngine';
import { makeItem } from '@/lib/itemFactory';
import { useGameStore, type ItemType } from '@/store/gameStore';

function ctx(
  actor: 'player' | 'dealer',
  itemType: ItemType,
  overrides: Partial<ItemEffectContext> = {}
): ItemEffectContext {
  const shells = [
    { type: 'live' as const, revealed: false },
    { type: 'blank' as const, revealed: false },
  ];
  return {
    actor,
    item: makeItem(itemType),
    playerHP: 4,
    playerMaxHP: 4,
    dealerHP: 4,
    dealerMaxHP: 4,
    shells,
    currentShellIndex: 0,
    currentShell: shells[0],
    actorSawActive: false,
    guillotineTriggered: false,
    opponentItems: [],
    ...overrides,
  };
}

describe('handcuffs direction', () => {
  it('player handcuffs skip dealer', () => {
    const result = executeItemEffect(ctx('player', 'handcuffs'));
    expect(result?.skipDealerTurn).toBe(true);
    expect(result?.skipPlayerTurn).toBeFalsy();
  });

  it('dealer handcuffs skip player', () => {
    const result = executeItemEffect(ctx('dealer', 'handcuffs'));
    expect(result?.skipPlayerTurn).toBe(true);
    expect(result?.skipDealerTurn).toBeFalsy();
  });
});

describe('magnifier info leak', () => {
  it('player magnifier reveals current shell', () => {
    const result = executeItemEffect(ctx('player', 'magnifier'));
    expect(result?.revealedShellIndices).toContain(0);
  });

  it('dealer magnifier does not reveal to player', () => {
    const result = executeItemEffect(ctx('dealer', 'magnifier'));
    expect(result?.revealedShellIndices).toBeUndefined();
  });
});

describe('guillotine fatal damage', () => {
  beforeEach(() => {
    useGameStore.setState({
      playerHP: 6,
      dealerHP: 6,
      guillotineTriggered: true,
    });
  });

  it('kills player on any damage', () => {
    useGameStore.getState().damage('player', 1);
    expect(useGameStore.getState().playerHP).toBe(0);
  });

  it('kills dealer on any damage', () => {
    useGameStore.getState().damage('dealer', 2);
    expect(useGameStore.getState().dealerHP).toBe(0);
  });
});

describe('guillotine blocks healing', () => {
  it('dealer cigarette returns null when guillotine is active', () => {
    const result = executeItemEffect(
      ctx('dealer', 'cigarette', {
        guillotineTriggered: true,
        dealerHP: 2,
        dealerMaxHP: 4,
      })
    );
    expect(result).toBeNull();
  });
});

describe('dealerDecision regressions', () => {
  it('does not choose magnifier', () => {
    const mag = makeItem('magnifier');
    const decision = dealerDecision(4, 4, 2, 1, 3, 4, [mag], false, false);
    expect(decision.action === 'use-item' && decision.itemId === mag.id).toBe(false);
  });

  it('does not choose cigarette while guillotine is active', () => {
    const cig = makeItem('cigarette');
    const decision = dealerDecision(1, 6, 2, 1, 3, 4, [cig], false, true);
    expect(decision.action === 'use-item' && decision.itemId === cig.id).toBe(false);
  });
});
