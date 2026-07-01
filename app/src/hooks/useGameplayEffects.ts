import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Types ───────────────────────────────────────────────

export interface ToastMsg {
  id: string;
  message: string;
  type: 'info' | 'damage' | 'heal' | 'item' | 'system';
}

// ─── Constants ───────────────────────────────────────────

export const ITEM_EFFECT_DURATION = 1200;

// ─── Helpers ─────────────────────────────────────────────

let toastId = 0;
const makeToast = (
  message: string,
  type: ToastMsg['type'] = 'info'
): ToastMsg => ({
  id: `toast-${++toastId}`,
  message,
  type,
});

/**
 * Centralized gameplay UI effects.
 *
 * Owns short-lived animation state (toasts, blood flash, screen shake,
 * muzzle flash, damage text, item-effect badge, revealed shell, shell eject)
 * and the timers that clear them. All timers are registered in a single set
 * and cleared on unmount so pending animation callbacks never fire against an
 * unmounted component.
 *
 * This hook intentionally holds no game-rule state: callers apply damage,
 * play SFX, and drive phase changes themselves.
 */
export function useGameplayEffects() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [bloodFlash, setBloodFlash] = useState(false);
  const [shakeScreen, setShakeScreen] = useState(false);
  const [muzzleFlash, setMuzzleFlash] = useState(false);
  const [shellEjectAnim, setShellEjectAnim] = useState(false);
  const [ejectedShellType, setEjectedShellType] = useState<
    'live' | 'blank' | null
  >(null);
  const [itemEffectAnim, setItemEffectAnim] = useState<string | null>(null);
  const [revealedShellIndex, setRevealedShellIndex] = useState<number | null>(
    null
  );
  const [damageFloatingText, setDamageFloatingText] = useState<{
    text: string;
    target: 'player' | 'dealer';
  } | null>(null);

  // Central timer registry so pending animation timeouts are cleaned up on
  // unmount instead of firing setState against a gone component.
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const schedule = useCallback((fn: () => void, delay: number) => {
    const id = setTimeout(() => {
      timersRef.current.delete(id);
      fn();
    }, delay);
    timersRef.current.add(id);
    return id;
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
    };
  }, []);

  // ── Toast queue ──
  const pushToast = useCallback(
    (message: string, type: ToastMsg['type'] = 'info') => {
      const t = makeToast(message, type);
      setToasts((prev) => [t, ...prev].slice(0, 5));
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Short UI effects ──
  const triggerBloodFlash = useCallback(() => {
    setBloodFlash(true);
    schedule(() => setBloodFlash(false), 900);
  }, [schedule]);

  const triggerShake = useCallback(() => {
    setShakeScreen(true);
    schedule(() => setShakeScreen(false), 300);
  }, [schedule]);

  const triggerMuzzleFlash = useCallback(() => {
    setMuzzleFlash(true);
    schedule(() => setMuzzleFlash(false), 250);
  }, [schedule]);

  const showDamageText = useCallback(
    (text: string, target: 'player' | 'dealer') => {
      setDamageFloatingText({ text, target });
      schedule(() => setDamageFloatingText(null), 1000);
    },
    [schedule]
  );

  const showItemEffect = useCallback(
    (type: string, duration = ITEM_EFFECT_DURATION) => {
      setItemEffectAnim(type);
      schedule(() => setItemEffectAnim(null), duration);
    },
    [schedule]
  );

  const showShellEject = useCallback(
    (type: 'live' | 'blank', duration = 800) => {
      setEjectedShellType(type);
      setShellEjectAnim(true);
      schedule(() => setShellEjectAnim(false), duration);
    },
    [schedule]
  );

  const showRevealedShell = useCallback(
    (index: number, duration = 2000) => {
      setItemEffectAnim('magnifier');
      setRevealedShellIndex(index);
      schedule(() => {
        setItemEffectAnim(null);
        setRevealedShellIndex(null);
      }, duration);
    },
    [schedule]
  );

  return {
    // Toast queue
    toasts,
    pushToast,
    dismissToast,
    // Short UI effects
    bloodFlash,
    triggerBloodFlash,
    shakeScreen,
    triggerShake,
    muzzleFlash,
    triggerMuzzleFlash,
    damageFloatingText,
    showDamageText,
    itemEffectAnim,
    showItemEffect,
    revealedShellIndex,
    showRevealedShell,
    shellEjectAnim,
    ejectedShellType,
    showShellEject,
  };
}
