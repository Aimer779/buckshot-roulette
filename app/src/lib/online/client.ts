import type { RoomSession } from './protocol';

export class OnlineError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function requestOnline<T>(path: string, method = 'GET', body?: unknown, session?: RoomSession): Promise<T> {
  const response = await fetch(`/api/rooms${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  });
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new OnlineError('联机服务未启动，请使用支持联机的游戏服务地址。', 503);
  }
  const result = await response.json();
  if (!response.ok) throw new OnlineError(result.error ?? '请求失败。', response.status);
  return result as T;
}

const KEY = 'buckshot-online-session';
export function readSession(): RoomSession | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
    return value && /^\d{6}$/.test(value.code) && /^[a-f0-9]{64}$/.test(value.token) ? value : null;
  } catch { return null; }
}
export function saveSession(session: RoomSession | null) {
  try {
    if (session) sessionStorage.setItem(KEY, JSON.stringify(session));
    else sessionStorage.removeItem(KEY);
  } catch { /* The active tab can still play when browser storage is disabled. */ }
}
