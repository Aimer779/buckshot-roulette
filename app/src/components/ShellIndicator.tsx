import { memo } from 'react';
import { motion } from 'framer-motion';
import { CircleHelp } from 'lucide-react';
import type { Shell } from '@/store/gameStore';

interface ShellIndicatorProps {
  shells: Shell[];
  currentIndex?: number;
  showUnknown?: boolean;
}

/**
 * Shell Indicator Component
 * Shows the full magazine: spent shells keep their real color,
 * remaining shells show revealed color or question mark.
 * Live = red filled circle with glow
 * Blank = blue filled circle
 * Unknown = gray with question mark
 */
const ShellIndicator = memo(function ShellIndicator({
  shells,
  currentIndex = 0,
  showUnknown = false,
}: ShellIndicatorProps) {
  const remaining = shells.slice(currentIndex);
  const liveCount = remaining.filter((s) => s.type === 'live').length;
  const blankCount = remaining.filter((s) => s.type === 'blank').length;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Count display */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full"
            style={{
              backgroundColor: 'var(--accent-red)',
              boxShadow: '0 0 8px rgba(220, 38, 38, 0.6)',
            }}
          />
          <span className="font-pixel text-xl" style={{ color: 'var(--accent-red-glow)' }}>
            {liveCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full"
            style={{
              backgroundColor: 'var(--accent-blue-dim)',
              boxShadow: '0 0 4px rgba(59, 130, 246, 0.3)',
            }}
          />
          <span className="font-pixel text-xl" style={{ color: 'var(--accent-blue)' }}>
            {blankCount}
          </span>
        </div>
      </div>

      {/* Shell icons row */}
      {showUnknown ? (
        <div className="flex items-center gap-2 flex-wrap justify-center max-w-[240px]">
          {shells.map((shell, index) => {
            const isSpent = index < currentIndex;

            return (
              <motion.div
                key={`shell-${index}`}
                initial={isSpent ? false : { opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, type: 'spring', stiffness: 300 }}
              >
                {isSpent ? (
                  <div
                    className="w-5 h-5 rounded-full opacity-60"
                    style={{
                      backgroundColor:
                        shell.type === 'live' ? 'var(--accent-red)' : 'var(--accent-blue-dim)',
                      boxShadow:
                        shell.type === 'live'
                          ? '0 0 6px rgba(220, 38, 38, 0.4)'
                          : '0 0 3px rgba(59, 130, 246, 0.2)',
                    }}
                  />
                ) : shell.revealed ? (
                  <div
                    className="w-6 h-6 rounded-full"
                    style={{
                      backgroundColor:
                        shell.type === 'live' ? 'var(--accent-red)' : 'var(--accent-blue-dim)',
                      boxShadow:
                        shell.type === 'live'
                          ? '0 0 8px rgba(220, 38, 38, 0.6)'
                          : '0 0 4px rgba(59, 130, 246, 0.3)',
                    }}
                  />
                ) : (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'var(--bg-elevated)' }}
                  >
                    <CircleHelp className="w-4 h-4" style={{ color: 'var(--text-dim)' }} />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {/* Just show summary */}
          <span className="font-pixel text-sm" style={{ color: 'var(--text-dim)' }}>
            剩余: {remaining.length}
          </span>
        </div>
      )}
    </div>
  );
});

export default ShellIndicator;
