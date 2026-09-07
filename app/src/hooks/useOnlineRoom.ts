import { useCallback, useEffect, useRef, useState } from 'react';
import { OnlineError, readSession, requestOnline, saveSession } from '@/lib/online/client';
import type { JoinResult, RoomAction, RoomSession, RoomView } from '@/lib/online/protocol';

export function useOnlineRoom() {
  const [session, setSession] = useState<RoomSession | null>(readSession);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const lock = useRef(false);

  const accept = useCallback((view: RoomView) => {
    setRoom(current => !current || current.code !== view.code || current.revision <= view.revision ? view : current);
    setConnected(true);
  }, []);

  useEffect(() => {
    if (!session) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const view = await requestOnline<RoomView>(`/${session.code}`, 'GET', undefined, session);
        if (!stopped) accept(view);
      } catch (err) {
        if (stopped) return;
        setConnected(false);
        if (err instanceof OnlineError && [401, 404].includes(err.status)) {
          saveSession(null);
          setSession(null);
          setRoom(null);
          setError(err.message);
          return;
        }
      }
      if (!stopped) timer = setTimeout(poll, 800);
    };
    void poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [session, accept]);

  const enter = async (name: string, password: string, code?: string) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await requestOnline<JoinResult>(code ? `/${code}/join` : '', 'POST', { name, password });
      saveSession(result.session);
      setSession(result.session);
      accept(result.room);
    } catch (err) { setError(err instanceof Error ? err.message : '无法连接联机服务。'); }
    finally { lock.current = false; setBusy(false); }
  };

  const act = async (action: RoomAction) => {
    if (!session || !room || lock.current || !connected) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      accept(await requestOnline<RoomView>(`/${session.code}/action`, 'POST', { revision: room.revision, action }, session));
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败，请等待同步。');
      // A timed-out command may already have executed. Never resend it automatically.
      try { accept(await requestOnline<RoomView>(`/${session.code}`, 'GET', undefined, session)); }
      catch { setConnected(false); }
    } finally { lock.current = false; setBusy(false); }
  };

  const leave = async () => {
    if (!session || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await requestOnline(`/${session.code}`, 'DELETE', undefined, session);
      saveSession(null);
      setSession(null);
      setRoom(null);
      setError('');
      setConnected(false);
    } catch (err) { setError(err instanceof Error ? err.message : '退出失败，请重试。'); }
    finally { lock.current = false; setBusy(false); }
  };

  return { room, session, connected, busy, error, enter, act, leave };
}
