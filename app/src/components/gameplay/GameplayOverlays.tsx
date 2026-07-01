import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Cigarette } from 'lucide-react';
import MessageToast from '@/components/MessageToast';
import type { GamePhase } from '@/store/gameStore';
import type { ToastMsg } from '@/hooks/useGameplayEffects';
import type { RoundLabel } from './GameplayHud';

interface GameplayOverlaysProps {
  roundAnnounce: boolean;
  currentRound: number;
  roundLabel: RoundLabel;
  showGuillotineWarning: boolean;
  bloodFlash: boolean;
  damageFloatingText: { text: string; target: 'player' | 'dealer' } | null;
  settingsOpen: boolean;
  phase: GamePhase;
  dealerThinking: boolean;
  itemEffectAnim: string | null;
  toasts: ToastMsg[];
  onDismissToast: (id: string) => void;
  onCloseSettings: () => void;
  onQuit: () => void;
}

/**
 * Fixed-position overlays layered above the game area: round announcement,
 * guillotine warning, blood flash, floating damage text, settings dialog,
 * toasts, the mobile phase indicator, and cigarette smoke.
 */
export default function GameplayOverlays({
  roundAnnounce,
  currentRound,
  roundLabel,
  showGuillotineWarning,
  bloodFlash,
  damageFloatingText,
  settingsOpen,
  phase,
  dealerThinking,
  itemEffectAnim,
  toasts,
  onDismissToast,
  onCloseSettings,
  onQuit,
}: GameplayOverlaysProps) {
  return (
    <>
      {/* Round announcement */}
      <AnimatePresence>
        {roundAnnounce && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.2, opacity: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
              className="flex flex-col items-center gap-4 px-12 py-8 rounded-xl border-2"
              style={{
                borderColor: 'var(--accent-gold)',
                backgroundColor: 'rgba(10, 10, 15, 0.95)',
                boxShadow: '0 0 40px rgba(212, 165, 32, 0.3)',
              }}
            >
              <span
                className="font-chinese text-3xl sm:text-5xl font-black"
                style={{
                  color: 'var(--accent-gold)',
                  textShadow: '0 0 20px rgba(212, 165, 32, 0.5)',
                }}
              >
                第 {currentRound} 回合
              </span>
              <span
                className="font-chinese text-lg"
                style={{ color: 'var(--text-secondary)' }}
              >
                {roundLabel.text}
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Guillotine warning */}
      <AnimatePresence>
        {showGuillotineWarning && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-[150] flex items-center justify-center pointer-events-none"
          >
            <div
              className="flex items-center gap-4 px-8 py-4 rounded-xl border-2"
              style={{
                borderColor: 'var(--accent-red)',
                backgroundColor: 'rgba(139, 26, 26, 0.9)',
                boxShadow: '0 0 40px rgba(220, 38, 38, 0.5)',
              }}
            >
              <AlertTriangle className="w-8 h-8" style={{ color: 'var(--accent-gold)' }} />
              <div className="flex flex-col">
                <span
                  className="font-chinese text-xl font-bold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  闸刀已触发！
                </span>
                <span
                  className="font-chinese text-sm"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  恢复类道具失效，下次受伤即死
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Blood flash overlay */}
      <AnimatePresence>
        {bloodFlash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="fixed inset-0 z-[120] pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(139, 26, 26, 0.5) 0%, transparent 70%)',
            }}
          />
        )}
      </AnimatePresence>

      {/* Damage floating text */}
      <AnimatePresence>
        {damageFloatingText && (
          <motion.div
            initial={{ opacity: 1, y: 0, x: '-50%', scale: 1 }}
            animate={{ opacity: 0, y: -80, scale: 1.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="fixed z-[130] pointer-events-none font-pixel text-4xl font-bold"
            style={{
              left: damageFloatingText.target === 'player' ? '50%' : '50%',
              bottom: damageFloatingText.target === 'player' ? '20%' : '60%',
              color: damageFloatingText.text.startsWith('+')
                ? 'var(--hp-full)'
                : 'var(--accent-red)',
              textShadow: damageFloatingText.text.startsWith('+')
                ? '0 0 10px rgba(16, 185, 129, 0.8)'
                : '0 0 10px rgba(220, 38, 38, 0.8)',
            }}
          >
            {damageFloatingText.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings panel */}
      <AnimatePresence>
        {settingsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[140] flex items-center justify-center"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
            onClick={onCloseSettings}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="flex flex-col gap-4 p-6 rounded-xl w-[320px]"
              style={{
                backgroundColor: 'var(--bg-dark)',
                border: '1px solid var(--bg-elevated)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              }}
            >
              <h3
                className="font-chinese text-xl font-bold text-center"
                style={{ color: 'var(--text-primary)' }}
              >
                游戏设置
              </h3>

              <button
                onClick={onCloseSettings}
                className="w-full py-2 rounded-lg font-chinese text-sm font-medium transition-all hover:brightness-110"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--bg-surface)',
                }}
              >
                继续游戏
              </button>

              <button
                onClick={onQuit}
                className="w-full py-2 rounded-lg font-chinese text-sm font-medium transition-all hover:brightness-110"
                style={{
                  backgroundColor: 'rgba(220, 38, 38, 0.2)',
                  color: 'var(--accent-red)',
                  border: '1px solid var(--accent-red)',
                }}
              >
                返回主菜单
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast messages */}
      <MessageToast
        messages={toasts}
        onDismiss={onDismissToast}
        autoDismiss
        dismissDelay={2500}
      />

      {/* Phase indicator (mobile only - shown at bottom) */}
      <div className="fixed bottom-2 left-1/2 -translate-x-1/2 z-50 sm:hidden">
        <span
          className="font-pixel text-xs px-3 py-1 rounded-full"
          style={{
            color: 'var(--text-dim)',
            backgroundColor: 'rgba(10, 10, 15, 0.8)',
          }}
        >
          {phase === 'ROUND_START' && '回合开始'}
          {phase === 'PLAYER_TURN' && '你的回合'}
          {phase === 'DEALER_TURN' && (dealerThinking ? '思考中...' : '行动中')}
          {phase === 'ANIMATING' && '...'}
          {phase === 'GAME_OVER' && '游戏结束'}
        </span>
      </div>

      {/* Cigarette smoke effect (item use) */}
      <AnimatePresence>
        {itemEffectAnim === 'cigarette' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.3, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
            className="fixed bottom-[15%] left-1/2 -translate-x-1/2 z-[90] pointer-events-none"
          >
            <Cigarette className="w-12 h-12" style={{ color: 'var(--smoke-gray)' }} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
