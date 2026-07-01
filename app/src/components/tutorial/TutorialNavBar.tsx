import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { navBarVariants } from '@/lib/tutorialAnimations';

interface TutorialNavBarProps {
  onBack: () => void;
  onSkip: () => void;
}

/**
 * Top navigation bar: back button, centered title, and skip-tutorial button.
 */
export default function TutorialNavBar({ onBack, onSkip }: TutorialNavBarProps) {
  return (
    <motion.div
      className="w-full flex items-center justify-between mb-4"
      style={{ maxWidth: '900px', height: '64px' }}
      variants={navBarVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Back button */}
      <motion.button
        onClick={onBack}
        className="flex items-center gap-2 px-4 h-10 rounded-lg transition-colors"
        style={{ color: 'var(--text-secondary)' }}
        whileHover={{ x: -2, color: 'var(--text-primary)' }}
        whileTap={{ scale: 0.95 }}
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="font-chinese text-base">返回</span>
      </motion.button>

      {/* Title */}
      <h1
        className="absolute left-1/2 -translate-x-1/2 font-chinese text-xl sm:text-2xl font-bold pointer-events-none"
        style={{ color: 'var(--text-primary)' }}
      >
        游戏说明
      </h1>

      {/* Skip button */}
      <motion.button
        onClick={onSkip}
        className="font-chinese text-sm transition-colors"
        style={{ color: 'var(--text-dim)', textDecoration: 'underline' }}
        whileHover={{ color: 'var(--text-secondary)' }}
      >
        跳过教程
      </motion.button>
    </motion.div>
  );
}
