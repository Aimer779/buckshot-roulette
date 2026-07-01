import { useCallback, useRef, useState } from 'react';
import { useGameStore, type ShellType } from '@/store/gameStore';
import type { GamePhase } from '@/store/gameStore';
import { playSFX } from '@/lib/sound';

export type ShootAnimationTarget = 'self' | 'dealer';

interface UseShootSequenceInput {
  setPhase: (phase: GamePhase) => void;
  triggerShake: () => void;
  triggerMuzzleFlash: () => void;
  showShellEject: (type: ShellType, duration?: number) => void;
}

export function useShootSequence({
  setPhase,
  triggerShake,
  triggerMuzzleFlash,
  showShellEject,
}: UseShootSequenceInput) {
  const isAnimatingRef = useRef(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [shootingAnim, setShootingAnim] = useState<ShootAnimationTarget | null>(null);

  const shoot = useCallback(
    (target: ShootAnimationTarget) =>
      new Promise<ShellType | null>((resolve) => {
        if (isAnimatingRef.current) {
          resolve(null);
          return;
        }

        isAnimatingRef.current = true;
        setIsAnimating(true);

        const shell = useGameStore.getState().useCurrentShell();
        if (!shell) {
          isAnimatingRef.current = false;
          setIsAnimating(false);
          resolve(null);
          return;
        }

        setPhase('ANIMATING');
        setShootingAnim(target);
        playSFX('shotgun-pump');

        setTimeout(() => {
          triggerShake();
          triggerMuzzleFlash();
          playSFX(shell.type === 'live' ? 'shotgun-fire' : 'shotgun-click');
          playSFX('shell-eject');
          showShellEject(shell.type);

          setTimeout(() => {
            setShootingAnim(null);
            isAnimatingRef.current = false;
            setIsAnimating(false);
            resolve(shell.type);
          }, 600);
        }, 400);
      }),
    [setPhase, triggerShake, triggerMuzzleFlash, showShellEject]
  );

  return {
    isAnimatingRef,
    isAnimating,
    shootingAnim,
    shoot,
  };
}
