import { motion, AnimatePresence } from 'framer-motion';
import { manualVariants, contentVariants, pageVariants, easeSharp } from '@/lib/tutorialAnimations';

interface TutorialManualProps {
  currentPage: number;
  direction: number;
  children: React.ReactNode;
}

/**
 * The manual panel: bordered glass shell, left red neon edge, and the
 * animated content area that transitions between pages.
 */
export default function TutorialManual({ currentPage, direction, children }: TutorialManualProps) {
  return (
    <motion.div
      className="w-full rounded-xl border overflow-hidden flex flex-col"
      style={{
        maxWidth: '900px',
        width: 'min(90vw, 800px)',
        height: 'calc(100dvh - 200px)',
        backgroundColor: 'rgba(20, 20, 27, 0.9)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
      }}
      variants={manualVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Left red neon edge decoration */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{
          backgroundColor: 'var(--accent-red)',
          boxShadow: '0 0 12px var(--accent-red)',
          zIndex: 5,
        }}
      />

      {/* Content area */}
      <motion.div
        className="flex-1 p-6 sm:p-8 overflow-y-auto"
        variants={contentVariants}
        initial="hidden"
        animate="visible"
      >
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentPage}
            custom={direction}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: 'tween', duration: 0.3, ease: easeSharp },
              opacity: { duration: 0.2 },
            }}
            className="h-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
