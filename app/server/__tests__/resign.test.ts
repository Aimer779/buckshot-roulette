import { describe, expect, it } from 'vitest';
import { Rooms } from '../rooms';

describe('match resignation', () => {
  it('allows the waiting-turn player to concede and retains an immutable result', async () => {
    const rooms = new Rooms();
    const host = await rooms.create('host', 'secret');
    const guest = await rooms.join(host.session.code, 'guest', 'secret');
    const { code } = host.session;
    const read = () => rooms.read(code, host.session.token);
    rooms.action(code, host.session.token, read().revision, { type: 'ready', ready: true });
    rooms.action(code, guest.session.token, read().revision, { type: 'ready', ready: true });
    rooms.action(code, host.session.token, read().revision, { type: 'start' });
    expect(read().turn).toBe(0);
    const result = rooms.action(code, guest.session.token, read().revision, { type: 'resign' });
    expect(result.winner).toBe(0);
    expect(result.closure).toMatchObject({ reason: 'resigned', actor: 1 });
    expect(result.events.at(-1)?.type).toBe('resigned');
    expect(read().closure).toEqual(result.closure);
    expect(() => rooms.action(code, host.session.token, result.revision, { type: 'resign' })).toThrow('结束');
  });
  it('rejects resignation before a match starts', async () => {
    const rooms = new Rooms();
    const host = await rooms.create('host', 'secret');
    expect(() => rooms.action(host.session.code, host.session.token, host.room.revision, { type: 'resign' })).toThrow('正在进行');
  });
});
