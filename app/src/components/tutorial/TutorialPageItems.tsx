import { motion } from 'framer-motion';
import { ITEM_INFO } from '@/store/gameStore';
import { itemCardVariants } from '@/lib/tutorialAnimations';
import { TUTORIAL_ITEM_DETAILS, type TutorialItemDetail } from '@/data/tutorialContent';
import TutorialSectionTitle from './TutorialSectionTitle';

interface TutorialPageItemsProps {
  onSelectItem: (item: TutorialItemDetail) => void;
}

/**
 * Page 3: item guide grid. Clicking a card opens its detail modal.
 */
export default function TutorialPageItems({ onSelectItem }: TutorialPageItemsProps) {
  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto">
      <TutorialSectionTitle className="mb-1">道具图鉴</TutorialSectionTitle>

      {/* Item grid */}
      <div className="grid grid-cols-3 gap-3">
        {TUTORIAL_ITEM_DETAILS.map((item, i) => (
          <motion.button
            key={item.type}
            custom={i}
            variants={itemCardVariants}
            initial="hidden"
            animate="visible"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelectItem(item)}
            className="flex flex-col items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--bg-elevated)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-gold)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 0 16px rgba(212, 165, 32, 0.2)';
              (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(212, 165, 32, 0.05)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--bg-elevated)';
              (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-surface)';
            }}
          >
            <img
              src={item.image}
              alt={item.name}
              className="w-12 h-12 sm:w-14 sm:h-14 object-contain pointer-events-none"
              draggable={false}
            />
            <span
              className="font-chinese text-sm font-bold text-center"
              style={{ color: 'var(--text-primary)' }}
            >
              {item.name}
            </span>
            <span
              className="font-chinese text-xs text-center leading-tight line-clamp-2"
              style={{ color: 'var(--text-secondary)' }}
            >
              {ITEM_INFO[item.type]?.description || item.description}
            </span>
          </motion.button>
        ))}
      </div>

      <p
        className="font-chinese text-xs text-center"
        style={{ color: 'var(--text-dim)' }}
      >
        点击道具查看详细说明。道具使用后立即消失，每回合使用数量不限。最多持有8个道具。
      </p>
    </div>
  );
}
