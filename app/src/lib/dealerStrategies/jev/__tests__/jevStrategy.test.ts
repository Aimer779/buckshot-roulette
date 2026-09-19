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

  it('includes magnifier only while the chamber is unknown; still omits phone', () => {
    const mag = makeItem('magnifier');
    const phone = makeItem('phone');
    expect(legalDealerActions(ctx({ dealerItems: [mag, phone] }))).toContain('use-magnifier');
    expect(legalDealerActions(ctx({ dealerItems: [mag, phone] }))).not.toContain('use-phone');
    expect(
      legalDealerActions(ctx({ dealerItems: [mag], knownChamber: 'live' }))
    ).not.toContain('use-magnifier');
    expect(legalDealerActions(ctx({ liveCount: 3, blankCount: 0, dealerItems: [mag] }))).not.toContain(
      'use-magnifier'
    );
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
    const request = buildJevRequest(ctx({ dealerItems: [makeItem('handsaw')] }), 'jev-1.13.0');
    expect(Object.keys(request.state)).not.toContain('shells');
    expect(Object.keys(request.state)).not.toContain('currentShellIndex');
    expect(JSON.stringify(request)).not.toContain('"shells"');
    expect(request.state.facts.liveRatio).toBeCloseTo(0.6);
  });

  it('asks atomic Nouls, not a mixed action Choice', () => {
    const saw = makeItem('handsaw');
    const request = buildJevRequest(ctx({ dealerItems: [saw] }), 'jev-1.13.0');
    expect(request.questions.action).toBeUndefined();
    expect(request.questions.chamber_likely_live.type).toBe('noul');
    expect(request.questions.should_double.type).toBe('noul');
    expect(request.state.dealerItems).toEqual(['handsaw']);
  });
});

describe('answersToDecision', () => {
  const meta = {
    latencyMs: 120,
    model: 'jev-1.13.0',
    provider: 'typesafe' as const,
    fallback: false,
  };

  it('shoots the player when chamber_likely_live is above shootT', () => {
    const result = answersToDecision(ctx(), {
      chamber_likely_live: { noul: 0.8 },
    }, meta);
    expect(result.ok).toBe(true);
    expect(result.fallback).toBe(false);
    expect(result.hud.ruleFired).toBe('jev');
    expect(result.turn).toEqual({ action: 'shoot', target: 'dealer' });
  });

  it('uses the handsaw when should_double and chamber look live', () => {
    const saw = makeItem('handsaw');
    const result = answersToDecision(ctx({ dealerItems: [saw] }), {
      chamber_likely_live: { noul: 0.8 },
      should_double: { noul: 0.9 },
    }, meta);
    expect(result.ok).toBe(true);
    expect(result.turn).toEqual({
      action: 'use-item',
      itemId: saw.id,
      shootTarget: 'dealer',
    });
  });

  it('does not fall back just because no mixed Choice confidence exists', () => {
    const result = answersToDecision(ctx(), {
      chamber_likely_live: { noul: 0.2 },
    }, meta);
    expect(result.fallback).toBe(false);
    expect(result.turn).toEqual({ action: 'shoot', target: 'self' });
  });

  it('uses shootT from the settings slider', () => {
    const result = answersToDecision(ctx(), {
      chamber_likely_live: { noul: 0.2 },
    }, { ...meta, confidenceMin: 0.1 });
    expect(result.ok).toBe(true);
    expect(result.turn).toEqual({ action: 'shoot', target: 'dealer' });
  });
});

describe('forced dealer turns', () => {
  it('shoots self on a known blank without calling compose', async () => {
    const { resolveForcedDealerTurn } = await import('../forced');
    const result = resolveForcedDealerTurn(ctx({ liveCount: 0, blankCount: 3, shellsRemaining: 3 }));
    expect(result?.hud.ruleFired).toBe('forced');
    expect(result?.turn).toEqual({ action: 'shoot', target: 'self' });
  });

  it('saws then shoots the player on a known live', async () => {
    const { resolveForcedDealerTurn } = await import('../forced');
    const saw = makeItem('handsaw');
    const result = resolveForcedDealerTurn(
      ctx({ liveCount: 2, blankCount: 0, shellsRemaining: 2, dealerItems: [saw] })
    );
    expect(result?.hud.reason).toBe('known-live-saw');
    expect(result?.turn).toEqual({
      action: 'use-item',
      itemId: saw.id,
      shootTarget: 'dealer',
    });
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
      knownChamber: null,
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
      'knownChamber',
      'liveCount',
      'playerHP',
      'playerItems',
      'playerMaxHP',
      'shellsRemaining',
      'skipPlayerTurn',
    ]);
  });
});
