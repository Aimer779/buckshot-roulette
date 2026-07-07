import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEALER_STRATEGIES,
  DEFAULT_DEALER_STRATEGY_ID,
  getStrategyById,
  balancedStrategy,
  aggressiveStrategy,
  conservativeStrategy,
  resolveDealerTurnDecision,
} from '@/lib/dealerStrategies';
import type { DealerContext, DealerTurnDecision } from '@/lib/dealerStrategies';
import { makeItem } from '@/lib/itemFactory';
import { useGameStore } from '@/store/gameStore';

function assertUseItem(decision: DealerTurnDecision): asserts decision is {
  action: 'use-item';
  itemId: string;
  shootTarget: 'self' | 'dealer';
} {
  expect(decision.action).toBe('use-item');
}

function ctx(overrides: Partial<DealerContext> = {}): DealerContext {
  return {
    dealerHP: 4,
    playerHP: 4,
    dealerMaxHP: 4,
    liveCount: 2,
    blankCount: 2,
    shellsRemaining: 4,
    dealerItems: [],
    dealerSawActive: false,
    guillotineTriggered: false,
    ...overrides,
  };
}

describe('strategy registry', () => {
  it('registers three strategies', () => {
    expect(DEALER_STRATEGIES).toHaveLength(3);
    expect(DEALER_STRATEGIES.map((s) => s.id)).toEqual([
      'balanced',
      'aggressive',
      'conservative',
    ]);
  });

  it('returns default strategy for unknown ids', () => {
    expect(getStrategyById('nonexistent').id).toBe(DEFAULT_DEALER_STRATEGY_ID);
  });

  it('returns requested strategy for known ids', () => {
    expect(getStrategyById('aggressive').id).toBe('aggressive');
    expect(getStrategyById('conservative').id).toBe('conservative');
  });
});

describe('balanced strategy shooting', () => {
  it('shoots self when blanks are strictly dominant', () => {
    const decision = balancedStrategy.decide(ctx({ liveCount: 1, blankCount: 2, shellsRemaining: 3 }));
    expect(decision.action).toBe('shoot-self');
  });

  it('shoots player when live shells are dominant', () => {
    const decision = balancedStrategy.decide(ctx({ liveCount: 2, blankCount: 1, shellsRemaining: 3 }));
    expect(decision.action).toBe('shoot-player');
  });

  it('shoots player on a 50/50 split', () => {
    const decision = balancedStrategy.decide(ctx({ liveCount: 2, blankCount: 2, shellsRemaining: 4 }));
    expect(decision.action).toBe('shoot-player');
  });

  it('shoots player when no shells remain', () => {
    const decision = balancedStrategy.decide(ctx({ liveCount: 0, blankCount: 0, shellsRemaining: 0 }));
    expect(decision.action).toBe('shoot-player');
  });
});

describe('aggressive strategy shooting', () => {
  it('shoots self only when blanks are strongly dominant (>= 60%)', () => {
    const decision = aggressiveStrategy.decide(ctx({ liveCount: 2, blankCount: 3, shellsRemaining: 5 }));
    expect(decision.action).toBe('shoot-self');
  });

  it('shoots player when blanks are just over half but below 60%', () => {
    const decision = aggressiveStrategy.decide(ctx({ liveCount: 3, blankCount: 3, shellsRemaining: 6 }));
    expect(decision.action).toBe('shoot-player');
  });

  it('shoots player on a 50/50 split', () => {
    const decision = aggressiveStrategy.decide(ctx({ liveCount: 2, blankCount: 2, shellsRemaining: 4 }));
    expect(decision.action).toBe('shoot-player');
  });

  it('shoots player when live shells are dominant', () => {
    const decision = aggressiveStrategy.decide(ctx({ liveCount: 3, blankCount: 1, shellsRemaining: 4 }));
    expect(decision.action).toBe('shoot-player');
  });
});

describe('conservative strategy shooting', () => {
  it('shoots self when blanks are at least 40%', () => {
    const decision = conservativeStrategy.decide(ctx({ liveCount: 3, blankCount: 2, shellsRemaining: 5 }));
    expect(decision.action).toBe('shoot-self');
  });

  it('shoots player when blanks are below 40%', () => {
    const decision = conservativeStrategy.decide(ctx({ liveCount: 4, blankCount: 1, shellsRemaining: 5 }));
    expect(decision.action).toBe('shoot-player');
  });

  it('shoots self on a 50/50 split', () => {
    const decision = conservativeStrategy.decide(ctx({ liveCount: 2, blankCount: 2, shellsRemaining: 4 }));
    expect(decision.action).toBe('shoot-self');
  });
});

describe('shared item priorities', () => {
  it('prefers cigarette when hurt and not in guillotine', () => {
    const cig = makeItem('cigarette');
    const decision = balancedStrategy.decide(
      ctx({ dealerHP: 2, dealerMaxHP: 4, dealerItems: [cig] })
    );
    expect(decision.action).toBe('use-item');
    expect(decision.itemId).toBe(cig.id);
  });

  it('does not choose cigarette while guillotine is active', () => {
    const cig = makeItem('cigarette');
    const decision = balancedStrategy.decide(
      ctx({ dealerHP: 1, dealerMaxHP: 4, dealerItems: [cig], guillotineTriggered: true })
    );
    expect(decision.action === 'use-item' && decision.itemId === cig.id).toBe(false);
  });

  it('does not choose magnifier', () => {
    const mag = makeItem('magnifier');
    const decision = balancedStrategy.decide(ctx({ dealerItems: [mag] }));
    expect(decision.action === 'use-item' && decision.itemId === mag.id).toBe(false);
  });

  it('uses handcuffs when shells remain', () => {
    const cuffs = makeItem('handcuffs');
    const decision = balancedStrategy.decide(
      ctx({ shellsRemaining: 4, dealerItems: [cuffs] })
    );
    expect(decision.action).toBe('use-item');
    expect(decision.itemId).toBe(cuffs.id);
  });

  it('uses handsaw when live ratio is high and saw is inactive', () => {
    const saw = makeItem('handsaw');
    const decision = balancedStrategy.decide(
      ctx({ liveCount: 3, blankCount: 1, shellsRemaining: 4, dealerItems: [saw] })
    );
    expect(decision.action).toBe('use-item');
    expect(decision.itemId).toBe(saw.id);
  });
});

describe('style differentiation', () => {
  it('balanced and aggressive shoot player while conservative shoots self at 2 blank / 2 live', () => {
    const c = ctx({ liveCount: 2, blankCount: 2, shellsRemaining: 4 });
    expect(balancedStrategy.decide(c).action).toBe('shoot-player');
    expect(aggressiveStrategy.decide(c).action).toBe('shoot-player');
    expect(conservativeStrategy.decide(c).action).toBe('shoot-self');
  });

  it('aggressive shoots player where balanced shoots self at 55% blanks', () => {
    const c = ctx({ liveCount: 4, blankCount: 5, shellsRemaining: 9 });
    expect(balancedStrategy.decide(c).action).toBe('shoot-self');
    expect(aggressiveStrategy.decide(c).action).toBe('shoot-player');
  });
});

describe('store integration', () => {
  beforeEach(() => {
    useGameStore.setState({ dealerStrategyId: 'balanced' });
  });

  it('setDealerStrategyId updates the store', () => {
    useGameStore.getState().setDealerStrategyId('aggressive');
    expect(useGameStore.getState().dealerStrategyId).toBe('aggressive');
  });
});

describe('resolveDealerTurnDecision', () => {
  it('maps shoot-self to self target', () => {
    const decision = resolveDealerTurnDecision(
      balancedStrategy,
      ctx({ liveCount: 1, blankCount: 2, shellsRemaining: 3 })
    );
    expect(decision).toEqual({ action: 'shoot', target: 'self' });
  });

  it('maps shoot-player to dealer target', () => {
    const decision = resolveDealerTurnDecision(
      balancedStrategy,
      ctx({ liveCount: 2, blankCount: 1, shellsRemaining: 3 })
    );
    expect(decision).toEqual({ action: 'shoot', target: 'dealer' });
  });

  it('locks the post-item shoot target when strategy wants to use an item', () => {
    const saw = makeItem('handsaw');
    const decision = resolveDealerTurnDecision(
      balancedStrategy,
      ctx({ liveCount: 3, blankCount: 1, shellsRemaining: 4, dealerItems: [saw] })
    );

    // The strategy wants the saw, and after the (simulated) saw is gone it
    // should still resolve to a concrete shooting target rather than a string
    // of further item decisions.
    expect(decision.action).toBe('use-item');
    assertUseItem(decision);
    expect(decision.itemId).toBe(saw.id);
    // blanks are not dominant (25%), so the locked target must be the player.
    expect(decision.shootTarget).toBe('dealer');
  });

  it('post-item target matches the strategy decision for a cigarette + shoot scenario', () => {
    const cig = makeItem('cigarette');
    // Hurt dealer with cigarette and blanks dominant: after healing it should
    // still shoot self because blanks > 50%.
    const decision = resolveDealerTurnDecision(
      balancedStrategy,
      ctx({
        dealerHP: 2,
        dealerMaxHP: 4,
        liveCount: 1,
        blankCount: 2,
        shellsRemaining: 3,
        dealerItems: [cig],
      })
    );

    expect(decision.action).toBe('use-item');
    assertUseItem(decision);
    expect(decision.itemId).toBe(cig.id);
    expect(decision.shootTarget).toBe('self');
  });

  it('does not re-enter infinite recursion when multiple usable items exist', () => {
    const cig = makeItem('cigarette');
    const cuffs = makeItem('handcuffs');
    const saw = makeItem('handsaw');

    const decision = resolveDealerTurnDecision(
      balancedStrategy,
      ctx({
        dealerHP: 2,
        dealerMaxHP: 4,
        liveCount: 3,
        blankCount: 1,
        shellsRemaining: 4,
        dealerItems: [cig, cuffs, saw],
      })
    );

    expect(decision.action).toBe('use-item');
    assertUseItem(decision);
    expect(decision.itemId).toBe(cig.id);
    // blanks are not dominant (25%), so the locked target must be the player.
    expect(decision.shootTarget).toBe('dealer');
  });
});

describe('adversarial item priority boundaries', () => {
  it('does not use handsaw when live ratio is exactly 0.5', () => {
    const saw = makeItem('handsaw');
    const decision = balancedStrategy.decide(
      ctx({ liveCount: 2, blankCount: 2, shellsRemaining: 4, dealerItems: [saw] })
    );
    expect(decision.action === 'use-item' && decision.itemId === saw.id).toBe(false);
  });

  it('does not use handcuffs when only 2 shells remain', () => {
    const cuffs = makeItem('handcuffs');
    const decision = balancedStrategy.decide(
      ctx({ shellsRemaining: 2, dealerItems: [cuffs] })
    );
    expect(decision.action === 'use-item' && decision.itemId === cuffs.id).toBe(false);
  });

  it('prefers cigarette over handcuffs when hurt and both are available', () => {
    const cig = makeItem('cigarette');
    const cuffs = makeItem('handcuffs');
    const decision = balancedStrategy.decide(
      ctx({
        dealerHP: 2,
        dealerMaxHP: 4,
        shellsRemaining: 4,
        dealerItems: [cuffs, cig],
      })
    );
    expect(decision.action).toBe('use-item');
    expect(decision.itemId).toBe(cig.id);
  });

  it('prefers handcuffs over phone and handsaw when healthy', () => {
    const cuffs = makeItem('handcuffs');
    const phone = makeItem('phone');
    const saw = makeItem('handsaw');
    const decision = balancedStrategy.decide(
      ctx({
        liveCount: 3,
        blankCount: 1,
        shellsRemaining: 4,
        dealerItems: [phone, saw, cuffs],
      })
    );
    expect(decision.action).toBe('use-item');
    expect(decision.itemId).toBe(cuffs.id);
  });

  it('does not use handsaw when saw is already active', () => {
    const saw = makeItem('handsaw');
    const decision = balancedStrategy.decide(
      ctx({
        liveCount: 3,
        blankCount: 1,
        shellsRemaining: 4,
        dealerSawActive: true,
        dealerItems: [saw],
      })
    );
    expect(decision.action === 'use-item' && decision.itemId === saw.id).toBe(false);
  });
});

describe('style differentiation at 3:2 and 2:3 ratios', () => {
  it('3 live / 2 blank shows conservative diverges from balanced/aggressive', () => {
    const c = ctx({ liveCount: 3, blankCount: 2, shellsRemaining: 5 });
    expect(balancedStrategy.decide(c).action).toBe('shoot-player');
    expect(aggressiveStrategy.decide(c).action).toBe('shoot-player');
    expect(conservativeStrategy.decide(c).action).toBe('shoot-self');
  });

  it('2 live / 3 blank (blank 60%) — all strategies shoot self', () => {
    const c = ctx({ liveCount: 2, blankCount: 3, shellsRemaining: 5 });
    expect(balancedStrategy.decide(c).action).toBe('shoot-self');
    expect(aggressiveStrategy.decide(c).action).toBe('shoot-self');
    expect(conservativeStrategy.decide(c).action).toBe('shoot-self');
  });
});
