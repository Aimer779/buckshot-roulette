import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, newMatch, player, type Match } from '../match';
import type { ItemType } from '../../src/store/gameStore';
import type { Seat } from '../../src/lib/online/protocol';

function playing(): Match {
  const match = newMatch('甲');
  match.players[1] = player('乙');
  act(match, 0, { type: 'ready', ready: true });
  act(match, 1, { type: 'ready', ready: true });
  act(match, 0, { type: 'start' });
  match.shells = ['blank', 'live', 'live'].map(type => ({ type: type as 'blank' | 'live', revealed: false }));
  return match;
}

function use(match: Match, seat: Seat, type: ItemType) {
  match.turn = seat;
  match.players[seat]!.items = [{ id: 'test', type }];
  act(match, seat, { type: 'item', itemId: 'test' });
}

afterEach(() => vi.restoreAllMocks());

describe('authoritative human-vs-human match', () => {
  it('requires two prepared players and host start', () => {
    const match = newMatch('甲');
    expect(() => act(match, 0, { type: 'start' })).toThrow();
    match.players[1] = player('乙');
    expect(() => act(match, 0, { type: 'start' })).toThrow();
    act(match, 0, { type: 'ready', ready: true });
    act(match, 1, { type: 'ready', ready: true });
    expect(() => act(match, 1, { type: 'start' })).toThrow();
    act(match, 0, { type: 'start' });
    expect(match.phase).toBe('playing');
  });

  it('rejects out-of-turn actions without consuming shells', () => {
    const match = playing();
    expect(() => act(match, 1, { type: 'shoot', target: 'opponent' })).toThrow();
    expect(match.index).toBe(0);
    match.players[1]!.connected = false;
    expect(() => act(match, 0, { type: 'shoot', target: 'opponent' })).toThrow();
    expect(match.index).toBe(0);
  });

  it('keeps a blank self-shot turn and consumes cuffs only when the turn would change', () => {
    const match = playing();
    use(match, 0, 'handcuffs');
    act(match, 0, { type: 'shoot', target: 'self' });
    expect(match.turn).toBe(0);
    expect(match.players[1]!.cuffed).toBe(true);
    act(match, 0, { type: 'shoot', target: 'opponent' });
    expect(match.turn).toBe(0);
    expect(match.players[1]!.cuffed).toBe(false);
  });

  it.each([0, 1] as const)('uses identical rules and private information for seat %s', seat => {
    const match = playing();
    const me = match.players[seat]!;
    const opponent = match.players[seat === 0 ? 1 : 0]!;
    use(match, seat, 'magnifier');
    expect([...match.known[seat]]).toEqual([0]);
    expect(match.known[seat === 0 ? 1 : 0].size).toBe(0);
    expect(match.logs.at(-1)).not.toContain('空包');
    use(match, seat, 'phone');
    expect(match.known[seat].size).toBe(2);
    use(match, seat, 'inverter');
    expect(match.shells[0].type).toBe('live');
    me.hp = 1;
    use(match, seat, 'cigarette');
    expect(me.hp).toBe(2);
    use(match, seat, 'handsaw');
    expect(me.saw).toBe(true);
    act(match, seat, { type: 'shoot', target: 'opponent' });
    expect(opponent.hp).toBe(0);
    expect(me.saw).toBe(false);
    expect(match.winner).toBe(seat);
  });

  it('preserves saw on blanks and scopes its damage to its owner', () => {
    const match = playing();
    use(match, 0, 'handsaw');
    act(match, 0, { type: 'shoot', target: 'opponent' });
    expect(match.players[0].saw).toBe(true);
    act(match, 1, { type: 'shoot', target: 'opponent' });
    expect(match.players[0].hp).toBe(1);
    expect(match.players[0].saw).toBe(true);
  });

  it.each([0, 1] as const)('applies medicine and theft to the acting human at seat %s', seat => {
    const match = playing();
    const me = match.players[seat]!;
    const opponent = match.players[seat === 0 ? 1 : 0]!;
    vi.spyOn(Math, 'random').mockReturnValue(0);
    me.hp = 1;
    use(match, seat, 'medicine');
    expect(me.hp).toBe(2);
    opponent.items = [{ type: 'handsaw', id: 'stolen' }];
    use(match, seat, 'adrenaline');
    expect(me.items).toEqual([{ type: 'handsaw', id: 'stolen' }]);
    expect(opponent.items).toEqual([]);
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    me.hp = 1;
    use(match, seat, 'medicine');
    expect(match.winner).toBe(seat === 0 ? 1 : 0);
  });

  it('reloads a blank tail after beer, clearing old private knowledge', () => {
    const match = playing();
    match.shells = [{ type: 'live', revealed: false }, { type: 'blank', revealed: false }];
    use(match, 0, 'magnifier');
    use(match, 0, 'beer');
    expect(match.index).toBe(0);
    expect(match.shells).toHaveLength(3);
    expect(match.known[0].size).toBe(0);
    expect(match.turn).toBe(0);
    expect(match.logs.some(message => message.includes('弹出实弹'))).toBe(true);
  });

  it('completes best-of-three with mutual continuation, alternate starts, and rematch', () => {
    const match = playing();
    for (let round = 1; round <= 2; round++) {
      match.turn = 0;
      match.players[1]!.hp = 1;
      match.shells[match.index].type = 'live';
      act(match, 0, { type: 'shoot', target: 'opponent' });
      expect(match.phase).toBe(round === 1 ? 'round-end' : 'finished');
      if (round === 1) {
        act(match, 0, { type: 'next' });
        expect(match.phase).toBe('round-end');
        act(match, 1, { type: 'next' });
        expect(match.turn).toBe(1);
        expect(match.players[0].hp).toBe(4);
      }
    }
    expect(match.players[0].score).toBe(2);
    act(match, 0, { type: 'rematch' });
    act(match, 1, { type: 'rematch' });
    expect(match.phase).toBe('playing');
    expect(match.round).toBe(1);
    expect(match.players[0].score).toBe(0);
    expect(match.players[0].hp).toBe(2);
  });
});
