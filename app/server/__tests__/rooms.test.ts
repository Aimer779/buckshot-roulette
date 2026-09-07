import { afterEach, describe, expect, it, vi } from 'vitest';
import { Rooms } from '../rooms';
import type { JoinResult, RoomAction } from '../../src/lib/online/protocol';

function action(rooms: Rooms, client: JoinResult, operation: RoomAction) {
  const { code, token } = client.session;
  const view = rooms.read(code, token);
  return rooms.action(code, token, view.revision, operation);
}

afterEach(() => vi.restoreAllMocks());

describe('password-protected two-seat rooms', () => {
  it('accepts simultaneous readiness from different seats but rejects same-seat replays', async () => {
    const rooms = new Rooms();
    const host = await rooms.create('甲', 'secret');
    const guest = await rooms.join(host.session.code, '乙', 'secret');
    const { code } = host.session;
    const revision = guest.room.revision;
    rooms.action(code, host.session.token, revision, { type: 'ready', ready: true });
    const view = rooms.action(code, guest.session.token, revision, { type: 'ready', ready: true });
    expect(view.players.every(p => p?.ready)).toBe(true);
    expect(() => rooms.action(code, host.session.token, revision, { type: 'ready', ready: false })).toThrow('更新');
    action(rooms, host, { type: 'start' });
    expect(() => rooms.action(code, guest.session.token, revision, { type: 'ready', ready: true })).toThrow('更新');
  });

  it('sends revealed shell information only to the player who used the item', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const rooms = new Rooms();
    const host = await rooms.create('甲', 'secret');
    const guest = await rooms.join(host.session.code, '乙', 'secret');
    action(rooms, host, { type: 'ready', ready: true });
    action(rooms, guest, { type: 'ready', ready: true });
    const start = action(rooms, host, { type: 'start' });
    const revealed = action(rooms, host, { type: 'item', itemId: start.players[0].items[0].id });
    expect(revealed.knownShells).toEqual([{ position: 1, type: 'blank' }]);
    expect(rooms.read(guest.session.code, guest.session.token).knownShells).toEqual([]);
    expect(revealed.logs.at(-1)).not.toContain('空包');
    action(rooms, host, { type: 'shoot', target: 'opponent' });
    const guestView = rooms.read(guest.session.code, guest.session.token);
    const guestReveal = action(rooms, guest, { type: 'item', itemId: guestView.players[1]!.items[0].id });
    expect(guestReveal.knownShells).toHaveLength(1);
    expect(rooms.read(host.session.code, host.session.token).knownShells).toEqual([]);
  });

  it('checks passwords, limits capacity even for simultaneous joins, and protects sessions', async () => {
    const rooms = new Rooms();
    const host = await rooms.create('甲', 'secret');
    const { code, token } = host.session;
    expect(code).toMatch(/^\d{6}$/);
    await expect(rooms.join(code, '乙', 'wrong')).rejects.toThrow('密码');
    const joined = await Promise.allSettled([
      rooms.join(code, '乙', 'secret'), rooms.join(code, '丙', 'secret'),
    ]);
    expect(joined.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(joined.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect(() => rooms.read(code, '')).toThrow('凭证');
    expect(() => rooms.read(code, 'invalid')).toThrow('凭证');
    const serialized = JSON.stringify(rooms.read(code, token));
    for (const secret of ['secret', token, 'password', 'salt', 'tokens', 'shells']) {
      expect(serialized).not.toContain(secret);
    }
  });

  it('rejects replayed commands and isolates rooms', async () => {
    const rooms = new Rooms();
    const first = await rooms.create('甲', 'secret');
    const second = await rooms.create('乙', 'secret');
    const { code, token } = first.session;
    rooms.action(code, token, first.room.revision, { type: 'ready', ready: true });
    expect(() => rooms.action(code, token, first.room.revision, { type: 'ready', ready: false })).toThrow('更新');
    expect(rooms.read(second.session.code, second.session.token).players[0].ready).toBe(false);
    expect(() => rooms.read(second.session.code, token)).toThrow('凭证');
  });

  it('pauses for a disconnected opponent and restores the same seat', async () => {
    let now = 1_000_000;
    const rooms = new Rooms(() => now);
    const host = await rooms.create('甲', 'secret');
    const guest = await rooms.join(host.session.code, '乙', 'secret');
    action(rooms, host, { type: 'ready', ready: true });
    action(rooms, guest, { type: 'ready', ready: true });
    action(rooms, host, { type: 'start' });
    now += 16_000;
    expect(rooms.read(host.session.code, host.session.token).players[1]!.connected).toBe(false);
    expect(() => action(rooms, host, { type: 'shoot', target: 'self' })).toThrow('连接');
    const reconnected = rooms.read(guest.session.code, guest.session.token);
    expect(reconnected.seat).toBe(1);
    expect(reconnected.phase).toBe('playing');
    expect(reconnected.players[1]!.connected).toBe(true);
    expect(action(rooms, host, { type: 'shoot', target: 'self' }).revision).toBeGreaterThan(reconnected.revision);
  });

  it('releases a departing lobby guest and expires an unattended single-player room', async () => {
    let now = 1_000_000;
    const rooms = new Rooms(() => now);
    const host = await rooms.create('甲', 'secret');
    const guest = await rooms.join(host.session.code, '乙', 'secret');
    rooms.leave(guest.session.code, guest.session.token);
    expect(rooms.read(host.session.code, host.session.token).players[1]).toBeNull();
    const idle = await rooms.create('甲', 'secret');
    now += 31 * 60_000;
    expect(rooms.read(idle.session.code, idle.session.token).closure?.reason).toBe('expired');
    now += 5 * 60_000;
    expect(() => rooms.read(idle.session.code, idle.session.token)).toThrow('关闭');
  });
});
