import { motion } from 'framer-motion';
import { Crosshair, Shield } from 'lucide-react';
import HealthBar from '@/components/HealthBar';
import ItemCard from '@/components/ItemCard';
import type { Item } from '@/store/gameStore';

interface PlayerAreaProps {
  playerHP: number;
  playerMaxHP: number;
  playerItems: Item[];
  actionsEnabled: boolean;
  onUseItem: (item: Item) => void;
  onShootSelf: () => void;
  onShootDealer: () => void;
}

/**
 * Player section: HP bar, item cards, and shoot action buttons.
 */
export default function PlayerArea({
  playerHP,
  playerMaxHP,
  playerItems,
  actionsEnabled,
  onUseItem,
  onShootSelf,
  onShootDealer,
}: PlayerAreaProps) {
  return (
    <div className="w-full max-w-4xl flex flex-col items-center gap-3">
      {/* Player HP */}
      <HealthBar current={playerHP} max={playerMaxHP} label="你的生命" />

      {/* Player items */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {playerItems.length === 0 && (
          <span
            className="font-chinese text-xs"
            style={{ color: 'var(--text-dim)' }}
          >
            没有道具
          </span>
        )}
        {playerItems.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            onClick={onUseItem}
            disabled={!actionsEnabled}
            size="md"
          />
        ))}
      </div>

      {/* ─── Action Buttons ─── */}
      <div className="flex items-center gap-3 sm:gap-6 w-full max-w-[600px] justify-center pb-2">
        {/* Shoot self button */}
        <motion.button
          whileHover={actionsEnabled ? { scale: 1.03, y: -2 } : {}}
          whileTap={actionsEnabled ? { scale: 0.98 } : {}}
          onClick={onShootSelf}
          disabled={!actionsEnabled}
          className="flex-1 max-w-[280px] h-[64px] sm:h-[72px] rounded-lg font-chinese font-bold flex flex-col items-center justify-center gap-0.5 transition-all"
          style={{
            fontSize: '18px',
            color: 'var(--text-primary)',
            border: `2px solid ${actionsEnabled ? 'var(--accent-blue-dim)' : 'var(--bg-elevated)'}`,
            background: actionsEnabled
              ? 'linear-gradient(180deg, rgba(30,30,40,0.9) 0%, rgba(10,10,15,0.95) 100%)'
              : 'rgba(20, 20, 27, 0.5)',
            opacity: actionsEnabled ? 1 : 0.4,
            cursor: actionsEnabled ? 'pointer' : 'not-allowed',
            boxShadow: actionsEnabled
              ? '0 4px 16px rgba(0,0,0,0.4), 0 0 20px rgba(59, 130, 246, 0.1)'
              : 'none',
          }}
        >
          <span className="flex items-center gap-2">
            <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
            射向自己
          </span>
          <span
            className="font-chinese text-xs"
            style={{ color: 'var(--accent-blue)', fontSize: '11px' }}
          >
            空包弹 = 额外回合
          </span>
        </motion.button>

        {/* Shoot dealer button */}
        <motion.button
          whileHover={actionsEnabled ? { scale: 1.03, y: -2 } : {}}
          whileTap={actionsEnabled ? { scale: 0.98 } : {}}
          onClick={onShootDealer}
          disabled={!actionsEnabled}
          className="flex-1 max-w-[280px] h-[64px] sm:h-[72px] rounded-lg font-chinese font-bold flex flex-col items-center justify-center gap-0.5 transition-all"
          style={{
            fontSize: '18px',
            color: 'var(--text-primary)',
            border: `2px solid ${actionsEnabled ? 'var(--accent-red)' : 'var(--bg-elevated)'}`,
            background: actionsEnabled
              ? 'linear-gradient(180deg, rgba(60,20,20,0.9) 0%, rgba(30,10,10,0.95) 100%)'
              : 'rgba(20, 20, 27, 0.5)',
            opacity: actionsEnabled ? 1 : 0.4,
            cursor: actionsEnabled ? 'pointer' : 'not-allowed',
            boxShadow: actionsEnabled
              ? '0 4px 16px rgba(0,0,0,0.4), 0 0 20px rgba(220, 38, 38, 0.15)'
              : 'none',
          }}
        >
          <span className="flex items-center gap-2">
            <Crosshair className="w-4 h-4 sm:w-5 sm:h-5" />
            射向对手
          </span>
          <span
            className="font-chinese text-xs"
            style={{ color: 'var(--accent-red-glow)', fontSize: '11px' }}
          >
            实弹 = 造成伤害
          </span>
        </motion.button>
      </div>
    </div>
  );
}
