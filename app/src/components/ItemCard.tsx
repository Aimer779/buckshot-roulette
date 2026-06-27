import { memo } from 'react';
import { motion } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ITEM_INFO, useGameStore } from '@/store/gameStore';
import type { Item, ItemType } from '@/store/gameStore';

interface ItemCardProps {
  item: Item;
  onClick?: (item: Item) => void;
  disabled?: boolean;
  selected?: boolean;
  size?: 'sm' | 'md';
}

/**
 * Reusable Item Card Component
 * 80x80 (desktop) / 64x64 (mobile)
 * Hover effects, click handler, disabled state
 */
const ItemCard = memo(function ItemCard({
  item,
  onClick,
  disabled = false,
  selected = false,
  size = 'md',
}: ItemCardProps) {
  const info = ITEM_INFO[item.type as ItemType];
  const isSmall = size === 'sm';
  const sizeClass = isSmall ? 'w-16 h-16' : 'w-20 h-20';
  const imgSize = isSmall ? 'w-10 h-10' : 'w-12 h-12';
  const itemEffectTipsEnabled = useGameStore((s) => s.itemEffectTipsEnabled);

  const card = (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.08 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      onClick={() => !disabled && onClick?.(item)}
      className={`
        ${sizeClass}
        relative flex flex-col items-center justify-center
        rounded-md border transition-all duration-200
        ${disabled
          ? 'opacity-40 grayscale cursor-not-allowed border-bg-elevated'
          : selected
            ? 'border-2 border-accent-gold cursor-pointer shadow-item-hover'
            : 'border-bg-elevated cursor-pointer hover:border-accent-gold hover:shadow-item-hover'
        }
      `}
      style={{ backgroundColor: 'var(--bg-surface)' }}
    >
      <img
        src={info?.image || '/item-magnifier.png'}
        alt={info?.name || item.type}
        className={`${imgSize} object-contain pointer-events-none`}
        draggable={false}
      />
      {selected && (
        <div
          className="absolute inset-0 rounded-md border-2 border-accent-gold"
          style={{ boxShadow: '0 0 12px rgba(212, 165, 32, 0.3)' }}
        />
      )}
    </motion.button>
  );

  if (!itemEffectTipsEnabled || !info) {
    return card;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{card}</TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>
        <div className="flex flex-col gap-1 max-w-[200px]">
          <span className="font-chinese font-bold text-sm">{info.name}</span>
          <span className="font-chinese text-xs opacity-90">{info.description}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
});

export default ItemCard;
