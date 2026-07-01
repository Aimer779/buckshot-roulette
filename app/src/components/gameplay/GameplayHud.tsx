import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Crosshair, Shield } from 'lucide-react';
import type { GamePhase } from '@/store/gameStore';

export interface RoundLabel {
  text: string;
  color: string;
  bg: string;
}

interface GameplayHudProps {
  phase: GamePhase;
  dealerThinking: boolean;
  currentRound: number;
  maxRounds: number;
  roundLabel: RoundLabel;
  sawActive: boolean;
  skipDealerTurn: boolean;
  onToggleSettings: () => void;
}

/**
 * Top HUD bar: round info, active-effect badges, phase message, settings.
 */
export default function GameplayHud({
  phase,
  dealerThinking,
  currentRound,
  maxRounds,
  roundLabel,
  sawActive,
  skipDealerTurn,
  onToggleSettings,
}: GameplayHudProps) {
  return (
    <div
      className="grid grid-cols-[1fr_auto_1fr] items-center px-4 py-2 shrink-0"
      style={{
        backgroundColor: 'rgba(10, 10, 15, 0.7)',
        backdropFilter: 'blur(6px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        height: '48px',
      }}
    >
      {/* Left: Round info */}
      <div className="flex items-center gap-2">
        <span
          className="font-chinese text-sm font-medium tracking-wider"
          style={{ color: 'var(--text-primary)' }}
        >
          第{' '}
          <span
            className="font-bold"
            style={{ color: 'var(--accent-red)', fontSize: '18px' }}
          >
            {currentRound}
          </span>{' '}
          回合 / 共{maxRounds}回合
        </span>
        <span
          className="font-chinese text-xs px-2 py-0.5 rounded-full"
          style={{
            color: roundLabel.color,
            backgroundColor: roundLabel.bg,
          }}
        >
          {roundLabel.text}
        </span>
        {sawActive && (
          <span
            className="flex items-center gap-1 font-chinese text-xs px-2 py-0.5 rounded-full border"
            style={{
              color: 'var(--accent-red)',
              borderColor: 'var(--accent-red)',
              backgroundColor: 'rgba(220, 38, 38, 0.2)',
            }}
          >
            <Crosshair className="w-3 h-3" />
            手锯
          </span>
        )}
        {skipDealerTurn && (
          <span
            className="flex items-center gap-1 font-chinese text-xs px-2 py-0.5 rounded-full border"
            style={{
              color: 'var(--accent-gold)',
              borderColor: 'var(--accent-gold)',
              backgroundColor: 'rgba(212, 165, 32, 0.2)',
            }}
          >
            <Shield className="w-3 h-3" />
            跳过
          </span>
        )}
      </div>

      {/* Center: Phase message */}
      <div className="hidden sm:flex items-center gap-2">
        <AnimatePresence mode="wait">
          <motion.span
            key={phase + (dealerThinking ? '-thinking' : '')}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="font-chinese text-base font-medium"
            style={{ color: 'var(--text-primary)' }}
          >
            {phase === 'ROUND_START' && '回合开始'}
            {phase === 'PLAYER_TURN' && '你的回合'}
            {phase === 'DEALER_TURN' && (dealerThinking ? '庄家思考中...' : '庄家行动中')}
            {phase === 'ANIMATING' && '...'}
            {phase === 'GAME_OVER' && '游戏结束'}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Right: Settings */}
      <div className="flex items-center justify-end">
        <button
          onClick={onToggleSettings}
          className="p-2 rounded-lg transition-all hover:bg-white/5"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
