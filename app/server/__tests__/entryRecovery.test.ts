import { describe, expect, it } from 'vitest';
import { Rooms } from '../rooms';

describe('entry receipts', () => {
  it('recovers a lost create response and shares concurrent retries', async () => {
    const rooms = new Rooms();
    const input = { name: 'host', password: 'secret', requestId: 'a'.repeat(64) };
    const [first, retry] = await Promise.all([rooms.enter(input), rooms.enter(input)]);
    expect(retry.session).toEqual(first.session);
    rooms.action(first.session.code, first.session.token, first.room.revision, { type: 'ready', ready: true });
    expect((await rooms.enter(input)).room.players[0].ready).toBe(true);
  });

  it('recovers the same guest seat after a lost join response', async () => {
    const rooms = new Rooms();
    const host = await rooms.create('host', 'secret');
    const input = { code: host.session.code, name: 'guest', password: 'secret', requestId: 'b'.repeat(64) };
    const first = await rooms.enter(input);
    expect((await rooms.enter(input)).session).toEqual(first.session);
    await expect(rooms.enter({ ...input, requestId: 'c'.repeat(64) })).rejects.toThrow('两位');
    await expect(rooms.enter({ ...input, password: 'different' })).rejects.toThrow('相同');
    rooms.leave(first.session.code, first.session.token);
    await expect(rooms.enter(input)).rejects.toThrow();
  });

  it('allows correcting credentials after a rejected entry', async () => {
    const rooms = new Rooms();
    const host = await rooms.create('host', 'secret');
    const input = { code: host.session.code, name: 'guest', password: 'wrong', requestId: 'd'.repeat(64) };
    await expect(rooms.enter(input)).rejects.toThrow('密码');
    expect((await rooms.enter({ ...input, password: 'secret' })).room.seat).toBe(1);
  });
});
