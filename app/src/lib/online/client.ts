import type { RoomSession, RoomView } from './protocol';

export class OnlineError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function fetchOnline(path: string, method: string, body?: unknown, session?: RoomSession, signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(8000);
  return fetch(`/api/rooms${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    cache: 'no-store',
  });
}

async function decodeResponse<T>(response: Response): Promise<T> {
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new OnlineError('联机服务未启动，请使用支持联机的游戏服务地址。', 503);
  }
  const result = await response.json();
  if (!response.ok) throw new OnlineError(result.error ?? '请求失败。', response.status);
  return result as T;
}

export async function requestOnline<T>(path: string, method = 'GET', body?: unknown, session?: RoomSession): Promise<T> {
  return decodeResponse<T>(await fetchOnline(path, method, body, session));
}

export async function pollOnlineRoom(session: RoomSession, since: number | undefined, signal: AbortSignal): Promise<RoomView | null> {
  const query = since === undefined ? '' : `?since=${since}`;
  const response = await fetchOnline(`/${session.code}${query}`, 'GET', undefined, session, signal);
  return response.status === 204 ? null : decodeResponse<RoomView>(response);
}

const KEY = 'buckshot-online-session';
const ENTRY_KEY = 'buckshot-online-entry';
let pendingEntry: { name: string; code?: string; requestId: string } | null = null;

export function entryRequestId(name: string, code?: string): string {
  try { pendingEntry ??= JSON.parse(sessionStorage.getItem(ENTRY_KEY) ?? 'null'); } catch { /* Storage is optional. */ }
  if (pendingEntry?.name !== name || pendingEntry?.code !== code || !/^[a-f0-9]{64}$/.test(pendingEntry?.requestId ?? '')) {
    const requestId = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
    pendingEntry = { name, code, requestId };
    try { sessionStorage.setItem(ENTRY_KEY, JSON.stringify(pendingEntry)); } catch { /* Keep the in-memory receipt. */ }
  }
  return pendingEntry!.requestId;
}

export function clearEntryRequest() {
  pendingEntry = null;
  try { sessionStorage.removeItem(ENTRY_KEY); } catch { /* Storage is optional. */ }
}

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
