import { useEffect, useRef, type ReactNode } from 'react';
import { useGameStore } from '@/store/gameStore';

interface LayoutProps {
  children: ReactNode;
}

/**
 * Game Layout Wrapper
 * Provides CRT scanline overlay, vignette effect, and screen shake support.
 * All game screens are wrapped in this component.
 */
export default function Layout({ children }: LayoutProps) {
  const crtEnabled = useGameStore((s) => s.crtEnabled);
  const screenShakeRef = useRef<HTMLDivElement>(null);

  // Screen shake effect
  useEffect(() => {
    const unsub = useGameStore.subscribe((state, prevState) => {
      // Trigger shake on damage
      if (
        (state.playerHP < prevState.playerHP || state.dealerHP < prevState.dealerHP) &&
        screenShakeRef.current
      ) {
        screenShakeRef.current.classList.add('screen-shake');
        setTimeout(() => {
          screenShakeRef.current?.classList.remove('screen-shake');
        }, 300);
      }
    });
    return () => unsub();
  }, []);

  return (
    <div
      ref={screenShakeRef}
      className="relative min-h-[100dvh] w-full overflow-hidden"
      style={{ backgroundColor: 'var(--bg-void)' }}
    >
      {/* Main content */}
      <div className="relative z-10 min-h-[100dvh]">{children}</div>

      {/* Vignette overlay */}
      <div className="vignette animate-pulse-glow" />

      {/* CRT scanline overlay */}
      {crtEnabled && <div className="crt-overlay" />}

      {/* Blood overlay for damage (hidden by default) */}
      <div id="blood-overlay" className="blood-overlay" />
    </div>
  );
}
