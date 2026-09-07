import { describe, expect, it } from 'vitest';
import { Rooms } from '../rooms';
import { HEARTBEAT_MS, RECONNECT_MS } from '../roomLifecycle';

describe('lobby seat release', () => {
  it('keeps the host room, revokes the guest token, and requires fresh readiness', async () => {
    const rooms = new Rooms();
    const host = await rooms.create('host', 'secret');
    const guest = await rooms.join(host.session.code, 'guest', 'secret');
    const { code, token } = host.session;
    const view = rooms.read(code, token);
    rooms.action(code, token, view.revision, { type: 'ready', ready: true });
    const pendingRevision = rooms.read(code, token).revision;
    rooms.leave(code, guest.session.token);
    const released = rooms.read(code, token);
    expect(released.phase).toBe('waiting');
    expect(released.players[1]).toBeNull();
    expect(released.players[0].ready).toBe(false);
    expect(released.events.at(-1)?.type).toBe('left');
    expect(() => rooms.action(code, token, pendingRevision, { type: 'ready', ready: true })).toThrow('更新');
    const replacement = await rooms.join(code, 'new guest', 'secret');
    expect(replacement.session.token).not.toBe(guest.session.token);
    expect(() => rooms.read(code, guest.session.token)).toThrow('失效');
    expect(replacement.room.players[1]?.name).toBe('new guest');
  });

  it('frees a guest after the grace period without expiring an active host room', async () => {
    let now = 1_000_000;
    const rooms = new Rooms(() => now);
    const host = await rooms.create('host', 'secret');
    const guest = await rooms.join(host.session.code, 'guest', 'secret');
    now += HEARTBEAT_MS + 1;
    rooms.read(host.session.code, host.session.token);
    now += RECONNECT_MS - 1;
    expect(rooms.read(host.session.code, host.session.token).players[1]).toBeNull();
    expect(() => rooms.read(guest.session.code, guest.session.token)).toThrow('期限已过');
    expect((await rooms.join(host.session.code, 'replacement', 'secret')).room.phase).toBe('waiting');
  });
});
