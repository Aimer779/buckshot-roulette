import { useCallback, useEffect, useRef, useState } from 'react';
import { clearEntryRequest, entryRequestId, OnlineError, pollOnlineRoom, readSession, requestOnline, saveSession } from '@/lib/online/client';
import { newerRoom } from '@/lib/online/sync';
import { OnlineRequestScope } from '@/lib/online/requestScope';
import type { JoinResult, RoomAction, RoomSession, RoomView } from '@/lib/online/protocol';

export function useOnlineRoom() {
  const [session, setSession] = useState<RoomSession | null>(readSession);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const healthSampleAt = useRef(0);
  const lock = useRef(false);
  const latestRoom = useRef<RoomView | null>(null);
  const requests = useRef(new OnlineRequestScope());

  const resetSession = useCallback((message = '') => {
    requests.current.invalidate();
    saveSession(null);
    latestRoom.current = null;
    lock.current = false;
    setSession(null);
    setRoom(null);
    setError(message);
    setConnected(false);
    setLatencyMs(null);
    setBusy(false);
  }, []);

  const accept = useCallback((view: RoomView) => {
    const next = newerRoom(latestRoom.current, view);
    if (next !== latestRoom.current) {
      latestRoom.current = next;
      setRoom(next);
    }
    setConnected(true);
  }, []);

  useEffect(() => {
    const scope = requests.current;
    const offline = () => { setConnected(false); setLatencyMs(null); };
    window.addEventListener('offline', offline);
    return () => {
      scope.invalidate();
      window.removeEventListener('offline', offline);
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    let stopped = false;
    let terminal = false;
    let polling = false;
    let failures = 0;
    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (stopped || terminal || polling) return;
      polling = true;
      const isCurrent = requests.current.capture();
      controller = new AbortController();
      const started = performance.now();
      try {
        const since = latestRoom.current?.code === session.code ? latestRoom.current.revision : undefined;
        const view = await pollOnlineRoom(session, since, controller.signal);
        if (stopped || !isCurrent()) return;
        if (view) accept(view);
        else setConnected(true);
        failures = 0;
        if (healthSampleAt.current === 0 || performance.now() - healthSampleAt.current >= 5000) {
          setLatencyMs(Math.round(performance.now() - started));
          healthSampleAt.current = performance.now();
        }
        if (view?.phase === 'closed' || latestRoom.current?.phase === 'closed') terminal = true;
      } catch (err) {
        if (stopped || !isCurrent()) return;
        setConnected(false);
        setLatencyMs(null);
        failures++;
        if (err instanceof OnlineError && [401, 404].includes(err.status)) {
          resetSession(err.message);
          terminal = true;
        }
      } finally { polling = false; }
      const delay = failures === 0 ? 800 : Math.round(Math.min(800 * 2 ** Math.min(failures, 4), 5000) * (0.8 + Math.random() * 0.2));
      if (!stopped && !terminal) timer = setTimeout(poll, delay);
    };
    const online = () => { clearTimeout(timer); void poll(); };
    window.addEventListener('online', online);
    void poll();
    return () => {
      stopped = true;
      controller?.abort();
      clearTimeout(timer);
      window.removeEventListener('online', online);
    };
  }, [session, accept, resetSession]);

  const enter = async (name: string, password: string, code?: string) => {
    if (lock.current) return;
    const isCurrent = requests.current.capture();
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const requestId = entryRequestId(name, code);
      const result = await requestOnline<JoinResult>(code ? `/${code}/join` : '', 'POST', { name, password, requestId });
      if (!isCurrent()) return;
      saveSession(result.session);
      clearEntryRequest();
      setSession(result.session);
      latestRoom.current = null;
      accept(result.room);
    } catch (err) {
      if (!isCurrent()) return;
      if (err instanceof OnlineError && [401, 404, 410].includes(err.status)) clearEntryRequest();
      setError(err instanceof Error ? err.message : '无法连接联机服务。');
    }
    finally { if (isCurrent()) { lock.current = false; setBusy(false); } }
  };

  const act = async (action: RoomAction) => {
    if (!session || !room || lock.current || !connected) return;
    const isCurrent = requests.current.capture();
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const view = await requestOnline<RoomView>(`/${session.code}/action`, 'POST', { revision: room.revision, action }, session);
      if (isCurrent()) accept(view);
    } catch (err) {
      if (!isCurrent()) return;
      setError(err instanceof Error ? err.message : '操作失败，请等待同步。');
      // A timed-out command may already have executed. Never resend it automatically.
      try {
        const view = await requestOnline<RoomView>(`/${session.code}`, 'GET', undefined, session);
        if (isCurrent()) accept(view);
      } catch { if (isCurrent()) setConnected(false); }
    } finally { if (isCurrent()) { lock.current = false; setBusy(false); } }
  };

  const leave = async () => {
    if (!session || lock.current) return;
    const isCurrent = requests.current.capture();
    lock.current = true;
    setBusy(true);
    try {
      await requestOnline(`/${session.code}`, 'DELETE', undefined, session);
      if (isCurrent()) resetSession();
    } catch (err) { if (isCurrent()) setError(err instanceof Error ? err.message : '退出失败，请重试。'); }
    finally { if (isCurrent()) { lock.current = false; setBusy(false); } }
  };

  const dismiss = () => {
    resetSession();
  };

  return { room, session, connected, latencyMs, busy, error, enter, act, leave, dismiss };
}
