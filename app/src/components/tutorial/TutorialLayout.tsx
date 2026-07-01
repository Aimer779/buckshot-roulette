import { motion } from 'framer-motion';
import { containerVariants } from '@/lib/tutorialAnimations';

interface TutorialLayoutProps {
  children: React.ReactNode;
}

/**
 * Page shell: animated root, background image, dark overlay, and the
 * centered content column that holds the tutorial sections.
 */
export default function TutorialLayout({ children }: TutorialLayoutProps) {
  return (
    <motion.div
      className="relative min-h-[100dvh] w-full overflow-hidden"
      style={{ backgroundColor: 'var(--bg-void)' }}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Background image */}
      <div
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: 'url(/bg-tutorial.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.4,
        }}
      />
      {/* Dark overlay */}
      <div
        className="fixed inset-0 z-[1]"
        style={{ backgroundColor: 'rgba(10, 10, 15, 0.6)' }}
      />

      {/* Content */}
      <div className="relative z-10 min-h-[100dvh] flex flex-col items-center px-4 py-6">
        {children}
      </div>
    </motion.div>
  );
}
