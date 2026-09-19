import { describe, expect, it } from 'vitest';
import { makeItem } from '@/lib/itemFactory';
import { answersToDecision } from '../answersToDecision';
import { buildJevRequest } from '../buildJevRequest';
import { toJevRequestBody } from '../client';
import type { JevDealerState } from '../types';
import { legalDealerActions } from '../../legalActions';
import type { DealerContext } from '../../types';

function ctx(overrides: Partial<DealerContext> = {}): DealerContext {
  return {
    dealerHP: 3,
    playerHP: 4,
    dealerMaxHP: 4,
    liveCount: 3,
    blankCount: 2,
    shellsRemaining: 5,
    dealerItems: [],
    dealerSawActive: false,
    guillotineTriggered: false,
    playerItems: [],
    playerMaxHP: 4,
    skipPlayerTurn: false,
    currentRound: 2,
    ...overrides,
  };
}

describe('legalDealerActions', () => {
  it('always includes both shoot options', () => {
    expect(legalDealerActions(ctx())).toEqual(['shoot-self', 'shoot-player']);
  });

  it('includes beer, inverter, medicine, and handsaw when legal', () => {
    const actions = legalDealerActions(
      ctx({
        dealerHP: 4,
        dealerItems: [
          makeItem('beer'),
          makeItem('inverter'),
          makeItem('medicine'),
          makeItem('handsaw'),
        ],
      })
    );
    expect(actions).toContain('use-beer');
    expect(actions).toContain('use-inverter');
    expect(actions).toContain('use-medicine');
    expect(actions).toContain('use-handsaw');
  });

  it('omits phone and magnifier in v1', () => {
    const actions = legalDealerActions(
      ctx({ dealerItems: [makeItem('phone'), makeItem('magnifier')] })
    );
    expect(actions).not.toContain('use-phone');
    expect(actions).not.toContain('use-magnifier');
  });

  it('omits handcuffs when only 2 shells remain or the player is already cuffed', () => {
    const cuffs = makeItem('handcuffs');
    expect(legalDealerActions(ctx({ shellsRemaining: 2, dealerItems: [cuffs] }))).not.toContain(
      'use-handcuffs'
    );
    expect(
      legalDealerActions(ctx({ shellsRemaining: 4, skipPlayerTurn: true, dealerItems: [cuffs] }))
    ).not.toContain('use-handcuffs');
    expect(
      legalDealerActions(ctx({ shellsRemaining: 4, skipPlayerTurn: false, dealerItems: [cuffs] }))
    ).toContain('use-handcuffs');
  });

  it('omits adrenaline when the player has no items', () => {
    const adrenaline = makeItem('adrenaline');
    expect(legalDealerActions(ctx({ dealerItems: [adrenaline], playerItems: [] }))).not.toContain(
      'use-adrenaline'
    );
    expect(
      legalDealerActions(ctx({ dealerItems: [adrenaline], playerItems: [makeItem('beer')] }))
    ).toContain('use-adrenaline');
  });

  it('omits cigarette at full HP or during guillotine', () => {
    const cig = makeItem('cigarette');
    expect(
      legalDealerActions(ctx({ dealerHP: 4, dealerMaxHP: 4, dealerItems: [cig] }))
    ).not.toContain('use-cigarette');
    expect(
      legalDealerActions(
        ctx({ dealerHP: 3, dealerMaxHP: 4, guillotineTriggered: true, dealerItems: [cig] })
      )
    ).not.toContain('use-cigarette');
    expect(
      legalDealerActions(ctx({ dealerHP: 3, dealerMaxHP: 4, dealerItems: [cig] }))
    ).toContain('use-cigarette');
  });
});

describe('buildJevRequest', () => {
  it('never puts shell order or currentShellIndex into state', () => {
    const request = buildJevRequest(ctx({ dealerItems: [makeItem('handsaw')] }), 'jev-latest');
    expect(Object.keys(request.state)).not.toContain('shells');
    expect(Object.keys(request.state)).not.toContain('currentShellIndex');
    expect(JSON.stringify(request)).not.toContain('"shells"');
  });

  it('restricts Choice criteria to legal actions', () => {
    const saw = makeItem('handsaw');
    const request = buildJevRequest(ctx({ dealerItems: [saw] }), 'jev-latest');
    expect(Object.keys(request.questions.action.criteria).sort()).toEqual(
      ['shoot-player', 'shoot-self', 'use-handsaw'].sort()
    );
    expect(request.state.dealerItems).toEqual(['handsaw']);
  });
});

describe('answersToDecision', () => {
  const meta = {
    latencyMs: 120,
    model: 'jev-latest',
    provider: 'typesafe' as const,
    fallback: false,
  };

  it('maps a legal shoot-player choice to the dealer target', () => {
    const result = answersToDecision(ctx(), {
      action: { choice: 'shoot-player', confidence: 0.8, probabilities: { 'shoot-player': 0.8 } },
      shoot_target: { choice: 'self' },
      live_belief: { score: 3.2 },
    }, meta);
    expect(result.ok).toBe(true);
    expect(result.turn).toEqual({ action: 'shoot', target: 'dealer' });
    expect(result.hud.liveBelief).toBe(3.2);
  });

  it('locks the post-item shoot target from the independent shoot_target question', () => {
    const saw = makeItem('handsaw');
    const result = answersToDecision(ctx({ dealerItems: [saw] }), {
      action: { choice: 'use-handsaw', confidence: 0.9, probabilities: { 'use-handsaw': 0.7 } },
      shoot_target: { choice: 'player' },
    }, meta);
    expect(result.ok).toBe(true);
    expect(result.turn).toEqual({
      action: 'use-item',
      itemId: saw.id,
      shootTarget: 'dealer',
    });
  });

  it('falls back when the choice is not legal', () => {
    const result = answersToDecision(ctx(), {
      action: { choice: 'use-handsaw', confidence: 0.99 },
    }, meta);
    expect(result.fallback).toBe(true);
    expect(result.hud.reason).toBe('illegal-action');
    expect(result.turn.action).toBe('shoot');
  });

  it('falls back when confidence is below the threshold', () => {
    const result = answersToDecision(ctx(), {
      action: { choice: 'shoot-player', confidence: 0.2, probabilities: { 'shoot-player': 0.4 } },
    }, meta);
    expect(result.fallback).toBe(true);
    expect(result.hud.reason).toBe('low-confidence');
  });

  it('accepts a low-confidence choice when the threshold is lowered', () => {
    const result = answersToDecision(ctx(), {
      action: { choice: 'shoot-player', confidence: 0.2, probabilities: { 'shoot-player': 0.4 } },
    }, { ...meta, confidenceMin: 0.1 });
    expect(result.ok).toBe(true);
    expect(result.fallback).toBe(false);
    expect(result.turn).toEqual({ action: 'shoot', target: 'dealer' });
  });
});

describe('toJevRequestBody', () => {
  it('only copies public fields, never a shells array', () => {
    const state: JevDealerState = {
      dealerHP: 3,
      playerHP: 4,
      dealerMaxHP: 4,
      playerMaxHP: 4,
      liveCount: 2,
      blankCount: 2,
      shellsRemaining: 4,
      dealerItems: [makeItem('beer')],
      playerItems: [makeItem('cigarette')],
      dealerSawActive: false,
      guillotineTriggered: false,
      skipPlayerTurn: false,
      currentRound: 2,
      confidenceMin: 0.2,
    };
    const body = toJevRequestBody(state);
    expect(body.confidenceMin).toBe(0.2);
    expect(Object.keys(body).sort()).toEqual([
      'blankCount',
      'confidenceMin',
      'currentRound',
      'dealerHP',
      'dealerItems',
      'dealerMaxHP',
      'dealerSawActive',
      'guillotineTriggered',
      'liveCount',
      'playerHP',
      'playerItems',
      'playerMaxHP',
      'shellsRemaining',
      'skipPlayerTurn',
    ]);
  });
});
