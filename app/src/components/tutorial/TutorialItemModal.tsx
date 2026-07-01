import { motion, AnimatePresence } from 'framer-motion';
import { Star, X } from 'lucide-react';
import { easeBounce } from '@/lib/tutorialAnimations';
import type { TutorialItemDetail } from '@/data/tutorialContent';

interface TutorialItemModalProps {
  item: TutorialItemDetail | null;
  onClose: () => void;
}

/**
 * Item detail modal shown when a tutorial item card is clicked.
 */
export default function TutorialItemModal({ item, onClose }: TutorialItemModalProps) {
  return (
    <AnimatePresence>
      {item && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="relative rounded-xl border p-6 w-full overflow-hidden"
            style={{
              maxWidth: '400px',
              backgroundColor: 'var(--bg-dark)',
              borderColor: 'var(--accent-gold)',
              borderWidth: '2px',
              boxShadow: '0 0 40px rgba(212, 165, 32, 0.2)',
            }}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ duration: 0.3, ease: easeBounce }}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-1 rounded-md transition-colors hover:bg-white/10"
              style={{ color: 'var(--text-dim)' }}
            >
              <X className="w-5 h-5" />
            </button>

            {/* Item icon */}
            <div className="flex flex-col items-center gap-3 mb-4">
              <motion.img
                src={item.image}
                alt={item.name}
                className="w-20 h-20 object-contain"
                draggable={false}
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, duration: 0.3, ease: easeBounce }}
              />
              <h3
                className="font-chinese text-xl font-bold"
                style={{ color: 'var(--text-primary)' }}
              >
                {item.name}
              </h3>
            </div>

            {/* Divider */}
            <div className="w-full h-px mb-4" style={{ backgroundColor: 'var(--bg-elevated)' }} />

            {/* Description */}
            <p
              className="font-chinese text-sm text-center leading-relaxed mb-4"
              style={{ color: 'var(--text-secondary)' }}
            >
              {item.description}
            </p>

            {/* Rating */}
            <div className="flex items-center justify-center gap-1 mb-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className="w-4 h-4"
                  style={{
                    color: i < item.rating ? 'var(--accent-amber)' : 'var(--bg-elevated)',
                    fill: i < item.rating ? 'var(--accent-amber)' : 'none',
                  }}
                />
              ))}
              <span
                className="font-chinese text-xs ml-2"
                style={{ color: 'var(--accent-amber)' }}
              >
                {item.rating >= 5 ? 'S级' : item.rating >= 4 ? 'A级' : 'B级'}
              </span>
            </div>

            {/* Category */}
            <p
              className="font-chinese text-xs text-center mb-4"
              style={{ color: 'var(--text-dim)' }}
            >
              用途: {item.category}
            </p>

            {/* Combo tip */}
            {item.combo && (
              <div
                className="rounded-md p-3 mb-4 border"
                style={{
                  backgroundColor: 'rgba(212, 165, 32, 0.1)',
                  borderColor: 'rgba(212, 165, 32, 0.2)',
                }}
              >
                <p className="font-chinese text-xs" style={{ color: 'var(--accent-gold)' }}>
                  经典Combo: {item.combo}
                </p>
              </div>
            )}

            {/* Tip */}
            {item.tip && (
              <p
                className="font-chinese text-xs text-center"
                style={{ color: 'var(--text-dim)' }}
              >
                提示: {item.tip}
              </p>
            )}

            {/* Close button */}
            <motion.button
              onClick={onClose}
              className="w-full mt-4 py-2 rounded-lg font-chinese text-sm font-medium transition-colors border"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                borderColor: 'var(--bg-elevated)',
              }}
              whileHover={{
                backgroundColor: 'var(--accent-red)',
                borderColor: 'var(--accent-red)',
              }}
              whileTap={{ scale: 0.98 }}
            >
              关闭
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
