import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import ShellIndicator from '@/components/ShellIndicator';
import type { Shell } from '@/store/gameStore';

interface ShotgunStageProps {
  shells: Shell[];
  currentShellIndex: number;
  shootingAnim: 'self' | 'dealer' | null;
  muzzleFlash: boolean;
  shellEjectAnim: boolean;
  ejectedShellType: 'live' | 'blank' | null;
  revealedShellIndex: number | null;
  itemEffectAnim: string | null;
}

/**
 * Central game area: shell indicator, shotgun image, muzzle flash, shell
 * eject animation, revealed-shell display, and the item-effect badge.
 */
export default function ShotgunStage({
  shells,
  currentShellIndex,
  shootingAnim,
  muzzleFlash,
  shellEjectAnim,
  ejectedShellType,
  revealedShellIndex,
  itemEffectAnim,
}: ShotgunStageProps) {
  return (
    <div className="flex flex-col items-center gap-4 relative">
      {/* Shell info panel */}
      <div
        className="flex flex-col items-center gap-2 px-6 py-3 rounded-xl"
        style={{
          backgroundColor: 'rgba(20, 20, 27, 0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <span
          className="font-chinese text-sm"
          style={{ color: 'var(--text-secondary)' }}
        >
          枪内子弹
        </span>
        <ShellIndicator
          shells={shells}
          currentIndex={currentShellIndex}
          showUnknown
        />
      </div>

      {/* Shotgun area */}
      <div className="relative flex items-center justify-center">
        {/* Shotgun image */}
        <motion.img
          src={
            shootingAnim === 'self'
              ? '/shotgun-aim-self.png'
              : shootingAnim === 'dealer'
                ? '/shotgun-aim-opponent.png'
                : '/shotgun-idle.png'
          }
          alt="霰弹枪"
          className="w-[min(400px,55vw)] sm:w-[min(500px,45vw)] object-contain"
          draggable={false}
          animate={shootingAnim ? { y: -15, scale: 1.05 } : { y: [0, 2, 0] }}
          transition={
            shootingAnim
              ? { duration: 0.3 }
              : { duration: 3, repeat: Infinity, ease: 'easeInOut' }
          }
        />

        {/* Muzzle flash overlay */}
        <AnimatePresence>
          {muzzleFlash && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.2 }}
              transition={{ duration: 0.1 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100px] h-[100px] rounded-full pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle, rgba(255,200,50,0.9) 0%, rgba(255,100,0,0.5) 30%, transparent 70%)',
              }}
            />
          )}
        </AnimatePresence>

        {/* Shell eject animation */}
        <AnimatePresence>
          {shellEjectAnim && (
            <motion.div
              initial={{ x: 20, y: -10, opacity: 1, rotate: 0 }}
              animate={{ x: 100, y: 60, opacity: 0, rotate: 720 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="absolute top-0 right-0 w-4 h-4 rounded-full"
              style={{
                backgroundColor:
                  ejectedShellType === 'live'
                    ? 'var(--accent-red)'
                    : 'var(--accent-blue-dim)',
                boxShadow:
                  ejectedShellType === 'live'
                    ? '0 0 8px rgba(220, 38, 38, 0.6)'
                    : '0 0 4px rgba(59, 130, 246, 0.3)',
              }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Revealed shell indicator */}
      <AnimatePresence>
        {revealedShellIndex !== null && itemEffectAnim === 'magnifier' && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="flex items-center gap-3 px-6 py-3 rounded-xl border-2"
            style={{
              borderColor:
                shells[revealedShellIndex]?.type === 'live'
                  ? 'var(--accent-red)'
                  : 'var(--accent-blue)',
              backgroundColor: 'rgba(20, 20, 27, 0.95)',
            }}
          >
            <div
              className="w-8 h-8 rounded-full"
              style={{
                backgroundColor:
                  shells[revealedShellIndex]?.type === 'live'
                    ? 'var(--accent-red)'
                    : 'var(--accent-blue-dim)',
                boxShadow:
                  shells[revealedShellIndex]?.type === 'live'
                    ? '0 0 16px rgba(220, 38, 38, 0.8)'
                    : '0 0 10px rgba(59, 130, 246, 0.5)',
              }}
            />
            <span
              className="font-chinese text-lg font-bold"
              style={{
                color:
                  shells[revealedShellIndex]?.type === 'live'
                    ? 'var(--accent-red)'
                    : 'var(--accent-blue)',
              }}
            >
              {shells[revealedShellIndex]?.type === 'live' ? '实弹' : '空包弹'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Item effect animation */}
      <AnimatePresence>
        {itemEffectAnim && itemEffectAnim !== 'magnifier' && (
          <motion.div
            initial={{ scale: 0, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0, opacity: 0, y: -20 }}
            className="flex items-center gap-2 px-5 py-2 rounded-xl"
            style={{
              backgroundColor: 'rgba(212, 165, 32, 0.2)',
              border: '1px solid var(--accent-gold)',
            }}
          >
            <Sparkles className="w-5 h-5" style={{ color: 'var(--accent-gold)' }} />
            <span
              className="font-chinese text-sm font-medium"
              style={{ color: 'var(--accent-gold)' }}
            >
              {itemEffectAnim === 'cigarette' && '香烟生效'}
              {itemEffectAnim === 'handsaw' && '手锯已装备'}
              {itemEffectAnim === 'handcuffs' && '手铐已使用'}
              {itemEffectAnim === 'beer' && '啤酒生效'}
              {itemEffectAnim === 'adrenaline' && '肾上腺素生效'}
              {itemEffectAnim === 'medicine' && '药品生效'}
              {itemEffectAnim === 'inverter' && '逆变器生效'}
              {itemEffectAnim === 'phone' && '手机通话中...'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
