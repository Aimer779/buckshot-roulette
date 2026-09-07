import { useEffect, useRef, useState } from 'react';
import { playSFX, preloadSound } from '@/lib/sound';
import { useGameStore } from '@/store/gameStore';
import { isNewLocalTurn } from '@/lib/online/turnAlerts';
import type { RoomView } from '@/lib/online/protocol';

const KEY = 'buckshot-online-turn-alerts';

export function useOnlineTurnAlert(room: RoomView | null, connected: boolean) {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
  });
  const soundEnabled = useGameStore(s => s.soundEnabled);
  const volume = useGameStore(s => s.sfxVolume);
  const previous = useRef<RoomView | null>(null);
  useEffect(() => { preloadSound('turn-ready'); }, []);
  useEffect(() => {
    const announce = isNewLocalTurn(previous.current, room);
    previous.current = room;
    if (announce && connected && room?.players.every(p => p?.connected) && enabled && soundEnabled) {
      playSFX('turn-ready', volume * 0.6);
    }
  }, [room, connected, enabled, soundEnabled, volume]);
  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    try { localStorage.setItem(KEY, next ? 'on' : 'off'); } catch { /* Keep the current preference in memory. */ }
    if (next && soundEnabled) playSFX('turn-ready', volume * 0.6);
  };
  return { enabled, toggle, soundEnabled };
}
