import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollText, PanelLeftOpen, PanelLeftClose, Trash2 } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import type { GameLog } from '@/store/gameStore';

const typeColor: Record<GameLog['type'], string> = {
  damage: 'var(--accent-red)',
  heal: 'var(--hp-full)',
  item: 'var(--accent-gold)',
  system: 'var(--accent-blue)',
  info: 'var(--text-secondary)',
};

const typeGlow: Record<GameLog['type'], string> = {
  damage: 'rgba(220, 38, 38, 0.25)',
  heal: 'rgba(16, 185, 129, 0.15)',
  item: 'rgba(212, 165, 32, 0.15)',
  system: 'rgba(59, 130, 246, 0.15)',
  info: 'rgba(156, 163, 175, 0.1)',
};

/**
 * GameLogPanel
 *
 * Wide screens (md+): a minimal left-edge handle (24px) that opens a floating
 * 220px drawer overlay; collapsed by default with an unread dot on the handle.
 * Narrow screens: a floating bottom-left button that opens a left-side Sheet drawer.
 */
export default function GameLogPanel() {
  const logs = useGameStore((s) => s.logs);
  const clearLogs = useGameStore((s) => s.clearLogs);
  const lastReadLogId = useGameStore((s) => s.lastReadLogId);
  const markLogsRead = useGameStore((s) => s.markLogsRead);
  const [collapsed, setCollapsed] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Unread count is derived from the id anchor: logs newer than lastReadLogId.
  // findIndex returns -1 when the anchor is gone (e.g. old logs sliced off) → all unread.
  const unreadCount = useMemo(() => {
    const idx = logs.findIndex((l) => l.id === lastReadLogId);
    return idx === -1 ? logs.length : idx;
  }, [logs, lastReadLogId]);

  // Mark logs as read whenever the wide-screen panel is expanded.
  useEffect(() => {
    if (!collapsed) markLogsRead();
  }, [collapsed, markLogsRead]);

  // Mark logs as read whenever the narrow-screen Sheet is opened.
  useEffect(() => {
    if (sheetOpen) markLogsRead();
  }, [sheetOpen, markLogsRead]);

  const hasLogs = logs.length > 0;
  const unreadBadge = unreadCount >= 100 ? '99+' : String(unreadCount);

  const logList = useMemo(
    () =>
      logs.map((log, i) => {
        const isUnread = i < unreadCount;
        return (
          <div
            key={log.id}
            className="px-2.5 py-1.5 rounded text-xs leading-snug break-words transition-all"
            style={{
              borderLeft: `3px solid ${typeColor[log.type]}`,
              backgroundColor: isUnread
                ? typeGlow[log.type]
                : 'rgba(255, 255, 255, 0.02)',
              color: 'var(--text-primary)',
              boxShadow: isUnread ? 'inset 0 0 0 1px rgba(212, 165, 32, 0.35)' : 'none',
            }}
          >
            {log.message}
          </div>
        );
      }),
    [logs, unreadCount]
  );

  const header = (
    <div className="flex items-center justify-between px-3 py-2 shrink-0 border-b border-white/5">
      <div className="flex items-center gap-2">
        <ScrollText className="w-4 h-4" style={{ color: 'var(--accent-gold)' }} />
        <span className="font-chinese text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          战斗记录
        </span>
        <span
          className="font-mono-data text-xs px-1.5 py-0.5 rounded-full"
          style={{
            color: 'var(--text-dim)',
            backgroundColor: 'var(--bg-elevated)',
          }}
        >
          {logs.length}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={clearLogs}
          disabled={!hasLogs}
          className="p-1.5 rounded-md transition-colors hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent"
          title="清空记录"
        >
          <Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
        </button>
      </div>
    </div>
  );

  const listArea = (
    <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0">
      {hasLogs ? (
        logList
      ) : (
        <div className="h-full flex flex-col items-center justify-center text-center px-4 gap-2">
          <ScrollText className="w-6 h-6 opacity-30" style={{ color: 'var(--text-dim)' }} />
          <span className="font-chinese text-xs" style={{ color: 'var(--text-dim)' }}>
            暂无战斗记录
          </span>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* ─── Wide screen: left edge handle + floating drawer overlay ─── */}
      <div className="hidden md:flex absolute left-0 top-0 bottom-0 z-20">
        <AnimatePresence initial={false} mode="popLayout">
          {!collapsed && (
            <motion.div
              key="panel"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 220, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="h-full max-h-full flex flex-col border-r border-white/5 overflow-hidden"
              style={{
                backgroundColor: 'rgba(10, 10, 15, 0.9)',
                backdropFilter: 'blur(8px)',
              }}
            >
              {header}
              {listArea}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Minimal left-edge handle: ~24px wide, vertically centered */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-28 flex items-center justify-center transition-colors hover:bg-white/10 border-r border-white/5"
          style={{ backgroundColor: 'rgba(10, 10, 15, 0.6)' }}
          title={collapsed ? '展开战斗记录' : '收起战斗记录'}
          aria-label={collapsed ? '展开战斗记录' : '收起战斗记录'}
        >
          {unreadCount > 0 && (
            <span
              className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full"
              style={{ backgroundColor: 'var(--accent-gold)' }}
            />
          )}
          {collapsed ? (
            <PanelLeftOpen className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          ) : (
            <PanelLeftClose className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          )}
        </button>
      </div>

      {/* ─── Narrow screen: floating trigger + left Sheet ─── */}
      <div className="md:hidden">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button
              className="fixed bottom-4 left-4 z-40 flex items-center gap-2 px-3 py-2 rounded-full shadow-lg border border-white/10"
              style={{
                backgroundColor: 'rgba(20, 20, 27, 0.95)',
                color: 'var(--text-primary)',
              }}
            >
              <ScrollText className="w-4 h-4" style={{ color: 'var(--accent-gold)' }} />
              <span className="font-chinese text-sm">战斗记录</span>
              {unreadCount > 0 && (
                <span
                  className="font-mono-data text-xs px-1.5 py-0.5 rounded-full"
                  style={{
                    color: 'var(--text-inverse)',
                    backgroundColor: 'var(--accent-gold)',
                  }}
                >
                  {unreadBadge}
                </span>
              )}
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] p-0 flex flex-col border-r border-white/10">
            <SheetHeader className="flex-row items-center justify-between p-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <ScrollText className="w-4 h-4" style={{ color: 'var(--accent-gold)' }} />
                <SheetTitle className="font-chinese text-sm font-medium text-[var(--text-primary)]">
                  战斗记录
                </SheetTitle>
                <span
                  className="font-mono-data text-xs px-1.5 py-0.5 rounded-full"
                  style={{
                    color: 'var(--text-dim)',
                    backgroundColor: 'var(--bg-elevated)',
                  }}
                >
                  {logs.length}
                </span>
              </div>
              <button
                onClick={() => {
                  clearLogs();
                  if (!hasLogs) setSheetOpen(false);
                }}
                disabled={!hasLogs}
                className="p-1.5 rounded-md transition-colors hover:bg-white/10 disabled:opacity-30"
                title="清空记录"
              >
                <Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
              </button>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {hasLogs ? (
                logList
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center px-4 gap-2">
                  <ScrollText className="w-6 h-6 opacity-30" style={{ color: 'var(--text-dim)' }} />
                  <span className="font-chinese text-xs" style={{ color: 'var(--text-dim)' }}>
                    暂无战斗记录
                  </span>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
