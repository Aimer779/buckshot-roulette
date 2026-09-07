import { describe, expect, it } from 'vitest';
import { newerRoom } from '../sync';

describe('snapshot reconciliation', () => {
  it('keeps object identity when the revision is unchanged or arrives late', () => {
    const current = { code: '123456', seat: 0 as const, revision: 5 };
    expect(newerRoom(current, { ...current })).toBe(current);
    expect(newerRoom(current, { ...current, revision: 4 })).toBe(current);
    const newer = { ...current, revision: 6 };
    expect(newerRoom(current, newer)).toBe(newer);
  });
  it('accepts a different room or seat independently of its revision', () => {
    const current = { code: '123456', seat: 0 as const, revision: 5 };
    const another = { ...current, code: '654321', revision: 1 };
    expect(newerRoom(current, another)).toBe(another);
    const differentSeat = { ...current, seat: 1 as const, revision: 1 };
    expect(newerRoom<{ code: string; seat: 0 | 1; revision: number }>(current, differentSeat)).toBe(differentSeat);
  });
});
