import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { paginationVariants } from '@/lib/tutorialAnimations';

interface TutorialPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/**
 * Pagination controls: previous button, dot indicators, and next button.
 */
export default function TutorialPagination({
  currentPage,
  totalPages,
  onPageChange,
}: TutorialPaginationProps) {
  return (
    <motion.div
      className="flex items-center justify-center gap-4 mt-4"
      variants={paginationVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Prev button */}
      <motion.button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 0}
        className="flex items-center gap-1 px-4 py-2 rounded-lg font-chinese text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        style={{ color: 'var(--text-secondary)' }}
        whileHover={currentPage !== 0 ? { scale: 1.05, color: 'var(--text-primary)' } : {}}
        whileTap={currentPage !== 0 ? { scale: 0.95 } : {}}
      >
        <ChevronLeft className="w-4 h-4" />
        上一页
      </motion.button>

      {/* Dot indicators */}
      <div className="flex items-center gap-2">
        {Array.from({ length: totalPages }).map((_, i) => (
          <button
            key={i}
            onClick={() => onPageChange(i)}
            className="rounded-full transition-all duration-200"
            style={{
              width: i === currentPage ? '24px' : '8px',
              height: '8px',
              backgroundColor: i === currentPage ? 'var(--accent-red)' : 'var(--bg-elevated)',
              boxShadow: i === currentPage ? '0 0 8px var(--accent-red)' : 'none',
            }}
            aria-label={`第 ${i + 1} 页`}
          />
        ))}
      </div>

      {/* Next button */}
      <motion.button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages - 1}
        className="flex items-center gap-1 px-4 py-2 rounded-lg font-chinese text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        style={{ color: 'var(--text-secondary)' }}
        whileHover={currentPage !== totalPages - 1 ? { scale: 1.05, color: 'var(--text-primary)' } : {}}
        whileTap={currentPage !== totalPages - 1 ? { scale: 0.95 } : {}}
      >
        下一页
        <ChevronRight className="w-4 h-4" />
      </motion.button>
    </motion.div>
  );
}
