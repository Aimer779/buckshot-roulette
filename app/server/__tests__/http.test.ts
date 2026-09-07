import { createServer, type Server } from 'node:http';
import { randomBytes } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createApiHandler } from '../http';
import type { JoinResult, RoomAction, RoomView } from '../../src/lib/online/protocol';

let server: Server | undefined;
afterEach(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server!.close(err => err ? reject(err) : resolve()));
    server = undefined;
  }
});

async function setup(trustedProxies = '') {
  server = createServer(createApiHandler(undefined, { trustedProxies }));
  await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/rooms`;
  return async (path = '', method = 'GET', body?: unknown, token?: string, headers: Record<string, string> = {}) => {
    if (method === 'POST' && (path === '' || path.endsWith('/join')) && typeof body === 'object') {
      body = { requestId: randomBytes(32).toString('hex'), ...body };
    }
    const response = await fetch(base + path, { method,
      headers: { 'Content-Type': 'application/json', ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, body: await response.json() };
  };
}

describe('online HTTP contract', () => {
  it('keeps separate limits behind a trusted proxy, while still limiting each client', async () => {
    const request = await setup('127.0.0.1');
    for (let i = 1; i <= 21; i++) {
      expect((await request('', 'POST', {}, undefined, { 'X-Forwarded-For': `192.0.2.${i}` })).status).toBe(400);
    }
    for (let i = 0; i < 19; i++) await request('', 'POST', {}, undefined, { 'X-Forwarded-For': '192.0.2.1' });
    expect((await request('', 'POST', {}, undefined, { 'X-Forwarded-For': '192.0.2.1' })).status).toBe(429);
  });

  it('cannot bypass the direct-client limit with forged forwarding headers', async () => {
    const request = await setup();
    for (let i = 1; i <= 20; i++) await request('', 'POST', {}, undefined, { 'X-Forwarded-For': `192.0.2.${i}` });
    expect((await request('', 'POST', {}, undefined, { 'X-Forwarded-For': '192.0.2.21' })).status).toBe(429);
  });

  it('validates credentials and actions before executing them', async () => {
    const request = await setup();
    expect((await request('', 'POST', { name: '', password: '1234' })).status).toBe(400);
    expect((await request('', 'POST', { name: '甲', password: '123' })).status).toBe(400);
    const created = await request('', 'POST', { name: '甲', password: '1234' });
    expect(created.status).toBe(200);
    const { session } = created.body as JoinResult;
    expect((await request(`/${session.code}`)).status).toBe(401);
    expect((await request(`/${session.code}/action`, 'POST', {
      revision: 0, action: { type: 'shoot', target: 'hacked' },
    }, session.token)).status).toBe(400);
    expect((await request(`/${session.code}/join`, 'POST', { name: '乙', password: 'nope' })).status).toBe(403);
  });

  it('synchronizes two separate clients through a full match and rematch', async () => {
    const request = await setup();
    const host = (await request('', 'POST', { name: '甲', password: '1234' })).body as JoinResult;
    const guest = (await request(`/${host.session.code}/join`, 'POST', { name: '乙', password: '1234' })).body as JoinResult;
    const clients = [host, guest];
    const read = async (client: JoinResult) => (await request(`/${client.session.code}`, 'GET', undefined, client.session.token)).body as RoomView;
    const act = async (client: JoinResult, action: RoomAction) => {
      const view = await read(client);
      const result = await request(`/${client.session.code}/action`, 'POST', { revision: view.revision, action }, client.session.token);
      expect(result.status).toBe(200);
      return result.body as RoomView;
    };
    await act(host, { type: 'ready', ready: true });
    await act(guest, { type: 'ready', ready: true });
    let view = await act(host, { type: 'start' });
    for (let commands = 0; view.phase !== 'finished' && commands < 150; commands++) {
      if (view.phase === 'round-end') {
        await act(host, { type: 'next' });
        view = await act(guest, { type: 'next' });
      } else {
        view = await act(clients[view.turn], { type: 'shoot', target: 'opponent' });
      }
      const other = await read(clients[view.seat === 0 ? 1 : 0]);
      expect(other.players).toEqual(view.players);
      expect(other.counts).toEqual(view.counts);
      expect(other.revision).toBe(view.revision);
    }
    expect(view.phase).toBe('finished');
    expect(view.players[view.winner!]!.score).toBe(2);
    await act(host, { type: 'rematch' });
    expect((await act(guest, { type: 'rematch' })).round).toBe(1);
    expect((await request(`/${host.session.code}`, 'DELETE', undefined, host.session.token)).status).toBe(200);
    expect((await request(`/${guest.session.code}`, 'GET', undefined, guest.session.token)).status).toBe(404);
  });
});
