import { motion } from 'framer-motion';
import { bottomVariants } from '@/lib/tutorialAnimations';

interface TutorialStartActionProps {
  visible: boolean;
  onStart: () => void;
}

/**
 * Final-page action button that enters the game.
 */
export default function TutorialStartAction({ visible, onStart }: TutorialStartActionProps) {
  return (
    <motion.div
      className="flex flex-col items-center gap-3 mt-4"
      variants={bottomVariants}
      initial="hidden"
      animate="visible"
    >
      {visible && (
        <motion.button
          onClick={onStart}
          className="btn-primary light-sweep"
          style={{ width: '320px', height: '56px' }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.98 }}
        >
          进入游戏 开始对决
        </motion.button>
      )}
    </motion.div>
  );
}
