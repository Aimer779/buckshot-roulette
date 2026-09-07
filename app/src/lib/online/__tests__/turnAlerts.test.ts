import { describe, expect, it } from 'vitest';
import { isNewLocalTurn } from '../turnAlerts';

const waiting = { code: '123456', seat: 0 as const, phase: 'waiting' as const, turn: 0 as const, round: 1 };
const playing = { ...waiting, phase: 'playing' as const };

describe('online turn cue', () => {
  it('announces match start and a newly assigned local turn', () => {
    expect(isNewLocalTurn(waiting, playing)).toBe(true);
    expect(isNewLocalTurn({ ...playing, turn: 1 }, playing)).toBe(true);
    expect(isNewLocalTurn(playing, { ...playing, round: 2 })).toBe(true);
  });
  it('does not replay on refresh, repeated snapshots, self-blank shots or seat changes', () => {
    expect(isNewLocalTurn(null, playing)).toBe(false);
    expect(isNewLocalTurn(playing, { ...playing })).toBe(false);
    expect(isNewLocalTurn(playing, { ...playing, turn: 1 })).toBe(false);
    expect(isNewLocalTurn(waiting, { ...playing, code: '654321' })).toBe(false);
    expect(isNewLocalTurn(waiting, { ...playing, seat: 1 })).toBe(false);
  });
});
