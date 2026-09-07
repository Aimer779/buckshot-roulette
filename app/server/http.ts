import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';
import { RoomError, Rooms } from './rooms';

const credentials = z.object({
  name: z.string().trim().min(1).max(20),
  password: z.string().min(4).max(64),
  requestId: z.string().regex(/^[a-f0-9]{64}$/),
});
const action = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ready'), ready: z.boolean() }),
  z.object({ type: z.literal('start') }),
  z.object({ type: z.literal('shoot'), target: z.enum(['self', 'opponent']) }),
  z.object({ type: z.literal('item'), itemId: z.string().min(1).max(100) }),
  z.object({ type: z.literal('next') }),
  z.object({ type: z.literal('rematch') }),
]);
const command = z.object({ revision: z.number().int().nonnegative(), action });

async function readBody(request: IncomingMessage) {
  if (!request.headers['content-type']?.startsWith('application/json')) {
    throw new RoomError('请求必须使用 JSON。', 415);
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 4096) throw new RoomError('请求过大。', 413);
    chunks.push(Buffer.from(chunk));
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown; }
  catch { throw new RoomError('无效的 JSON。'); }
}

function send(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(body));
}

export function createApiHandler(rooms = new Rooms()) {
  const attempts = new Map<string, { count: number; until: number }>();
  return async (request: IncomingMessage, response: ServerResponse) => {
    try {
      // No CORS: the browser accesses the API through the same origin as the game.
      const origin = request.headers.origin;
      if (origin && new URL(origin).host !== request.headers.host) throw new RoomError('不允许跨站请求。', 403);
      const path = new URL(request.url ?? '/', 'http://localhost').pathname;
      if (path === '/api/health' && request.method === 'GET') return send(response, 200, { ok: true });
      const match = /^\/api\/rooms(?:\/(\d{6})(?:\/(join|action))?)?$/.exec(path);
      if (!match) throw new RoomError('接口不存在。', 404);
      const [, code, operation] = match;
      if (request.method === 'POST' && (!code || operation === 'join')) {
        const now = Date.now();
        for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
        const ip = request.socket.remoteAddress ?? 'unknown';
        const limit = attempts.get(ip) ?? { count: 0, until: now + 60_000 };
        attempts.set(ip, limit);
        if (++limit.count > 20) throw new RoomError('尝试过于频繁，请一分钟后再试。', 429);
        const input = credentials.parse(await readBody(request));
        const result = await rooms.enter({ ...input, code });
        return send(response, 200, result);
      }
      if (!code) throw new RoomError('接口不存在。', 404);
      const token = request.headers.authorization?.replace(/^Bearer /, '') ?? '';
      if (request.method === 'GET' && !operation) return send(response, 200, rooms.read(code, token));
      if (request.method === 'DELETE' && !operation) {
        rooms.leave(code, token);
        return send(response, 200, { ok: true });
      }
      if (request.method === 'POST' && operation === 'action') {
        const input = command.parse(await readBody(request));
        return send(response, 200, rooms.action(code, token, input.revision, input.action));
      }
      throw new RoomError('不支持此操作。', 405);
    } catch (error) {
      if (error instanceof z.ZodError) return send(response, 400, { error: '请检查输入：昵称 1–20 字，密码 4–64 字，操作参数必须有效。' });
      const status = error instanceof RoomError ? error.status : 400;
      send(response, status, { error: error instanceof Error ? error.message : '请求失败。' });
    }
  };
}
