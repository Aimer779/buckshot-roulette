import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'info' | 'damage' | 'heal' | 'item' | 'system';
}

interface MessageToastProps {
  messages: ToastMessage[];
  onDismiss?: (id: string) => void;
  autoDismiss?: boolean;
  dismissDelay?: number;
}

/**
 * Message Toast Component
 * Slide-in message notifications from the top.
 * Auto-dismisses after a delay.
 */
export default function MessageToast({
  messages,
  onDismiss,
  autoDismiss = true,
  dismissDelay = 2000,
}: MessageToastProps) {
  useEffect(() => {
    if (autoDismiss && onDismiss) {
      const timers = messages.map((msg) =>
        setTimeout(() => onDismiss(msg.id), dismissDelay)
      );
      return () => timers.forEach(clearTimeout);
    }
  }, [messages, autoDismiss, dismissDelay, onDismiss]);

  const getBorderColor = (type: ToastMessage['type']) => {
    switch (type) {
      case 'damage':
        return 'var(--accent-red)';
      case 'heal':
        return 'var(--hp-full)';
      case 'item':
        return 'var(--accent-gold)';
      case 'system':
        return 'var(--accent-blue)';
      default:
        return 'var(--accent-red)';
    }
  };

  return (
    <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: -30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
            className="px-6 py-3 rounded-lg pointer-events-auto min-w-[200px] text-center"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderLeft: `4px solid ${getBorderColor(msg.type)}`,
              boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
            }}
          >
            <span
              className="font-chinese text-base font-medium"
              style={{ color: 'var(--text-primary)' }}
            >
              {msg.message}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
