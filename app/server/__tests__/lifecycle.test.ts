import { describe, expect, it } from 'vitest';
import { Rooms } from '../rooms';

describe('room lifecycle records', () => {
  it('reports joins, disconnections and reconnections once per transition', async () => {
    let now = 1_000_000;
    const rooms = new Rooms(() => now);
    const host = await rooms.create('host', 'secret');
    const guest = await rooms.join(host.session.code, 'guest', 'secret');
    const readHost = () => rooms.read(host.session.code, host.session.token);
    expect(readHost().events.map(e => e.type)).toEqual(['joined', 'joined']);
    now += 16_000;
    expect(readHost().events.at(-1)?.type).toBe('disconnected');
    const count = readHost().events.length;
    readHost();
    expect(readHost().events).toHaveLength(count);
    rooms.read(guest.session.code, guest.session.token);
    expect(readHost().events.at(-1)?.type).toBe('reconnected');
  });

  it('preserves closure reason and score, denies actions, and protects ended rooms', async () => {
    let now = 1_000_000;
    const rooms = new Rooms(() => now);
    const host = await rooms.create('host', 'secret');
    await rooms.join(host.session.code, 'guest', 'secret');
    rooms.leave(host.session.code, host.session.token);
    const view = rooms.read(host.session.code, host.session.token);
    expect(view.closure).toMatchObject({ reason: 'left', actor: 0 });
    expect(view.closure?.message).toContain('host');
    expect(view.players.map(p => p?.score)).toEqual([0, 0]);
    expect(() => rooms.read(host.session.code, 'invalid')).toThrow('凭证');
    expect(() => rooms.action(host.session.code, host.session.token, view.revision, { type: 'ready', ready: true })).toThrow('结束');
    now += 5 * 60_000;
    expect(() => rooms.read(host.session.code, host.session.token)).toThrow('关闭');
  });
});
