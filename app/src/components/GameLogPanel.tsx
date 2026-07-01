import { useState, useMemo } from 'react';
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
import { cn } from '@/lib/utils';
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
 * Wide screens (md+): a collapsible fixed panel on the left side of the game screen.
 * Narrow screens: a floating bottom-left button that opens a left-side Sheet drawer.
 */
export default function GameLogPanel() {
  const logs = useGameStore((s) => s.logs);
  const clearLogs = useGameStore((s) => s.clearLogs);
  const [collapsed, setCollapsed] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  const hasLogs = logs.length > 0;

  const logList = useMemo(
    () =>
      logs.map((log) => (
        <div
          key={log.id}
          className="px-2.5 py-1.5 rounded text-xs leading-snug break-words"
          style={{
            borderLeft: `3px solid ${typeColor[log.type]}`,
            backgroundColor: typeGlow[log.type],
            color: 'var(--text-primary)',
          }}
        >
          {log.message}
        </div>
      )),
    [logs]
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
      {/* ─── Wide screen: left floating drawer overlay ─── */}
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

        <button
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            'h-full flex flex-col items-center justify-start py-3 transition-colors hover:bg-white/5 border-r border-white/5',
            collapsed ? 'w-10' : 'w-8'
          )}
          style={{ backgroundColor: 'rgba(10, 10, 15, 0.6)' }}
          title={collapsed ? '展开战斗记录' : '收起战斗记录'}
        >
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
              {hasLogs && (
                <span
                  className="font-mono-data text-xs px-1.5 py-0.5 rounded-full"
                  style={{
                    color: 'var(--text-inverse)',
                    backgroundColor: 'var(--accent-gold)',
                  }}
                >
                  {logs.length}
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
