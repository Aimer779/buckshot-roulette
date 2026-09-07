import { describe, expect, it } from 'vitest';
import { Rooms } from '../rooms';
import { HEARTBEAT_MS, RECONNECT_MS } from '../roomLifecycle';
import type { JoinResult, RoomAction } from '../../src/lib/online/protocol';

const command = (rooms: Rooms, client: JoinResult, action: RoomAction) => {
  const { code, token } = client.session;
  return rooms.action(code, token, rooms.read(code, token).revision, action);
};

describe('bounded reconnection', () => {
  it('ends an abandoned match despite ongoing opponent heartbeats and prevents late revival', async () => {
    let now = 1_000_000;
    const rooms = new Rooms(() => now);
    const host = await rooms.create('host', 'secret');
    const guest = await rooms.join(host.session.code, 'guest', 'secret');
    command(rooms, host, { type: 'ready', ready: true });
    command(rooms, guest, { type: 'ready', ready: true });
    command(rooms, host, { type: 'start' });
    now += HEARTBEAT_MS + 1;
    const disconnected = rooms.read(host.session.code, host.session.token);
    expect(disconnected.reconnectUntil[1]).toBe(1_000_000 + HEARTBEAT_MS + RECONNECT_MS);
    now += RECONNECT_MS - 2;
    expect(rooms.read(host.session.code, host.session.token).phase).toBe('playing');
    now++;
    const ended = rooms.read(guest.session.code, guest.session.token);
    expect(ended.phase).toBe('closed');
    expect(ended.winner).toBe(0);
    expect(ended.closure).toMatchObject({ reason: 'connection-timeout', actor: 1 });
    expect(() => command(rooms, guest, { type: 'shoot', target: 'self' })).toThrow('结束');
  });

  it('allows reconnection before the deadline and clears the countdown', async () => {
    let now = 1_000_000;
    const rooms = new Rooms(() => now);
    const host = await rooms.create('host', 'secret');
    const guest = await rooms.join(host.session.code, 'guest', 'secret');
    now += HEARTBEAT_MS + 1;
    rooms.read(host.session.code, host.session.token);
    now += RECONNECT_MS - 2;
    expect(rooms.read(guest.session.code, guest.session.token).reconnectUntil[1]).toBeNull();
    expect(rooms.read(host.session.code, host.session.token).phase).toBe('waiting');
  });

  it('does not award an abandoned match to a player who also exceeded the deadline', async () => {
    let now = 1_000_000;
    const rooms = new Rooms(() => now);
    const host = await rooms.create('host', 'secret');
    const guest = await rooms.join(host.session.code, 'guest', 'secret');
    command(rooms, host, { type: 'ready', ready: true });
    command(rooms, guest, { type: 'ready', ready: true });
    command(rooms, host, { type: 'start' });
    now += HEARTBEAT_MS + RECONNECT_MS;
    const view = rooms.read(host.session.code, host.session.token);
    expect(view.phase).toBe('closed');
    expect(view.winner).toBeNull();
  });
});
