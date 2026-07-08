# 战斗记录浮层抽屉 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把宽屏战斗记录从"常驻 40px 竖条按钮 + 滑入面板"改为"默认完全收起、仅左缘 8px 极简拉手 + 左滑 220px 浮层覆盖"，并新增基于 id 锚点的未读提示（拉手亮点 + 面板内未读高亮），展开不加遮罩、可同时操作游戏。

**Architecture:** store 新增 `lastReadLogId` 字段作为未读真相源（不新增计数字段）；组件派生 `unreadCount`，宽屏分支重写为极简拉手 + 浮层，窄屏沿用 Sheet 仅改徽标数据源。`GameplayScreen.tsx` 不动。

**Tech Stack:** React 19, TypeScript, Zustand, Framer Motion, Tailwind CSS, shadcn/ui Sheet, Vitest.

## Global Constraints

- 命令从 `app/` 目录运行：`rtk pnpm test` / `rtk pnpm lint` / `rtk pnpm build`。
- 测试用 Vitest，新测试文件放在被测代码旁的 `__tests__/` 目录。
- 不改日志数据结构（`GameLog` 接口）、类型颜色映射、面板宽度（220px）、动画参数（`duration: 0.25, ease: [0.16,1,0.3,1]`）。
- 不加背景遮罩、不在面板内加额外关闭按钮（收起/展开统一用拉手）。
- 不改 `GameplayScreen.tsx`、不改 `addLog` 调用点（hooks/store 各处）。
- 日志 slice 上限 100 不变；未读数字 `>= 100` 显示 `99+`。
- 不显示时间戳。
- 注释密度与命名风格匹配周边代码（中文 UI 文案，英文代码注释）。

---

## File Structure

- **Modify:** `app/src/store/gameStore.ts` — 加 `lastReadLogId` 字段 + `markLogsRead` action，同步 `clearLogs`，`initialState` 含该字段（`resetGame` 经 `...initialState` 自然重置）。
- **Create:** `app/src/store/__tests__/gameStore.test.ts` — 覆盖 `lastReadLogId`/`markLogsRead`/`clearLogs`/`resetGame` 的未读语义。
- **Modify:** `app/src/components/GameLogPanel.tsx` — 重写宽屏分支（极简拉手 + 未读亮点 + 浮层 + 未读高亮 + markLogsRead effect），窄屏徽标改用派生 `unreadCount`。

---

## Task 1: store 新增 `lastReadLogId` 未读锚点（TDD）

**Files:**
- Modify: `app/src/store/gameStore.ts:87`（字段声明）、`app/src/store/gameStore.ts:111`（action 声明）、`app/src/store/gameStore.ts:235`（initialState）、`app/src/store/gameStore.ts:403`（clearLogs 实现）、`app/src/store/gameStore.ts:398-401`（addLog 不改，确认）
- Create: `app/src/store/__tests__/gameStore.test.ts`

**Interfaces:**
- Produces: store 字段 `lastReadLogId: string | null`、action `markLogsRead: () => void`。后续 Task 2 消费 `useGameStore((s) => s.lastReadLogId)` 和 `useGameStore((s) => s.markLogsRead)`。

- [ ] **Step 1: 写失败测试**

创建 `app/src/store/__tests__/gameStore.test.ts`：

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';

describe('lastReadLogId / markLogsRead', () => {
  beforeEach(() => {
    useGameStore.setState({ logs: [], lastReadLogId: null });
  });

  it('initial lastReadLogId is null', () => {
    expect(useGameStore.getState().lastReadLogId).toBeNull();
  });

  it('addLog does not touch lastReadLogId (new entries are implicitly unread)', () => {
    useGameStore.getState().addLog('hit', 'damage');
    useGameStore.getState().addLog('heal', 'heal');
    expect(useGameStore.getState().lastReadLogId).toBeNull();
  });

  it('markLogsRead sets lastReadLogId to current newest log id', () => {
    useGameStore.getState().addLog('old', 'damage');
    useGameStore.getState().addLog('new', 'heal');
    const newestId = useGameStore.getState().logs[0].id;
    useGameStore.getState().markLogsRead();
    expect(useGameStore.getState().lastReadLogId).toBe(newestId);
  });

  it('markLogsRead with empty logs sets null', () => {
    useGameStore.getState().markLogsRead();
    expect(useGameStore.getState().lastReadLogId).toBeNull();
  });

  it('clearLogs resets logs and lastReadLogId to null', () => {
    useGameStore.getState().addLog('x', 'damage');
    useGameStore.getState().markLogsRead();
    useGameStore.getState().clearLogs();
    expect(useGameStore.getState().logs).toEqual([]);
    expect(useGameStore.getState().lastReadLogId).toBeNull();
  });

  it('resetGame resets lastReadLogId to null', () => {
    useGameStore.getState().addLog('x', 'damage');
    useGameStore.getState().markLogsRead();
    useGameStore.getState().resetGame();
    expect(useGameStore.getState().lastReadLogId).toBeNull();
    expect(useGameStore.getState().logs).toEqual([]);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd app && rtk pnpm test -- app/src/store/__tests__/gameStore.test.ts`
Expected: FAIL — `lastReadLogId` 为 `undefined`（字段尚不存在），`markLogsRead is not a function`。

- [ ] **Step 3: 实现字段与 action**

在 `app/src/store/gameStore.ts` 的 `GameState` 接口中，找到 `// Game log` 区块（约第 86-87 行）：

```ts
  // Game log
  logs: GameLog[];
```

改为：

```ts
  // Game log
  logs: GameLog[];
  // Id of the newest log the player has seen; null = all unread.
  lastReadLogId: string | null;
```

在 action 声明区（约第 110-111 行）：

```ts
  addLog: (message: string, type: GameLog['type']) => void;
  clearLogs: () => void;
```

改为：

```ts
  addLog: (message: string, type: GameLog['type']) => void;
  markLogsRead: () => void;
  clearLogs: () => void;
```

在 `initialState`（约第 235 行）：

```ts
  logs: [] as GameLog[],
```

改为：

```ts
  logs: [] as GameLog[],
  lastReadLogId: null as string | null,
```

`addLog` 实现（约第 398-401 行）**保持不变**（新条目天然未读，无需改）：

```ts
  addLog: (message, type) =>
    set((s) => ({
      logs: [makeLog(message, type), ...s.logs].slice(0, 100),
    })),
```

在其后新增 `markLogsRead`，并把 `clearLogs` 改为同时重置 `lastReadLogId`（约第 403 行）：

```ts
  markLogsRead: () => set({ lastReadLogId: get().logs[0]?.id ?? null }),

  clearLogs: () => set({ logs: [], lastReadLogId: null }),
```

注：`resetGame` 用 `set({ ...initialState, ... })`，`initialState` 已含 `lastReadLogId: null`，无需额外改动。

- [ ] **Step 4: 运行测试确认通过**

Run: `cd app && rtk pnpm test -- app/src/store/__tests__/gameStore.test.ts`
Expected: PASS（6 个用例全绿）。

- [ ] **Step 5: 运行全量测试 + lint + build 确认无回归**

Run: `cd app && rtk pnpm test`
Expected: 全部通过。

Run: `cd app && rtk pnpm lint`
Expected: 无错误。

Run: `cd app && rtk pnpm build`
Expected: 类型检查通过，构建成功。

- [ ] **Step 6: 提交**

```bash
cd D:/code/smallgame/buckshot-roulette
git add app/src/store/gameStore.ts app/src/store/__tests__/gameStore.test.ts
git commit -m "feat: add lastReadLogId anchor and markLogsRead action for unread logs"
```

---

## Task 2: 重写 GameLogPanel 宽屏分支为极简拉手 + 浮层 + 未读高亮

**Files:**
- Modify: `app/src/components/GameLogPanel.tsx`（整体重写 return 的宽屏分支 + 顶部 hooks/派生逻辑）

**Interfaces:**
- Consumes: `useGameStore((s) => s.lastReadLogId)`、`useGameStore((s) => s.markLogsRead)`（来自 Task 1）。
- Produces: 宽屏浮层抽屉 UI（极简拉手、未读亮点、未读高亮、markLogsRead effect）。

- [ ] **Step 1: 重写组件顶部逻辑（hooks + 派生 + effect）**

打开 `app/src/components/GameLogPanel.tsx`。把第 1-13 行的 imports 和第 37-43 行的组件顶部替换为：

替换 imports（第 1-13 行）：

```tsx
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
import { cn } from '@/lib/utils';
import type { GameLog } from '@/store/gameStore';
```

（仅第 1 行新增 `useEffect`，其余不变。）

替换组件顶部（第 37-43 行 `export default function GameLogPanel()` 开头到 `hasLogs` 之前）：

```tsx
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

  const hasLogs = logs.length > 0;
  const unreadBadge = unreadCount >= 100 ? '99+' : String(unreadCount);
```

- [ ] **Step 2: 重写 logList 以支持未读高亮**

把第 45-61 行的 `logList` useMemo 替换为：

```tsx
  const logList = useMemo(
    () =>
      logs.map((log, i) => {
        const isUnread = i < unreadCount;
        return (
          <div
            key={log.id}
            className="px-2.5 py-1.5 rounded text-xs leading-snug break-words transition-colors"
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
```

注：未读条目用类型色微光 + 金色内描边高亮；已读条目用极淡白底以区分。`transition-colors` 让展开后高亮淡出更平滑（markLogsRead 使 unreadCount 归零，重新渲染）。

- [ ] **Step 3: 重写宽屏分支 return（极简拉手 + 浮层 + 未读亮点）**

把第 108-147 行（从 `return (` 到宽屏分支 `</div>` 结束，即 ` {/* ─── Narrow screen` 注释前）替换为：

```tsx
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

        {/* Minimal left-edge handle: ~8px wide, vertically centered */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-16 flex items-center justify-center transition-colors hover:bg-white/10 border-r border-white/5"
          style={{ backgroundColor: 'rgba(10, 10, 15, 0.6)' }}
          title={collapsed ? '展开战斗记录' : '收起战斗记录'}
          aria-label={collapsed ? '展开战斗记录' : '收起战斗记录'}
        >
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: 'var(--accent-gold)' }}
            />
          )}
          {collapsed ? (
            <PanelLeftOpen className="w-3 h-3" style={{ color: 'var(--text-secondary)' }} />
          ) : (
            <PanelLeftClose className="w-3 h-3" style={{ color: 'var(--text-secondary)' }} />
          )}
        </button>
      </div>
```

关键变化：
- 移除原 40px 竖条按钮（`w-10`/`w-8`），改为 `absolute` 定位的 8px 拉手（`w-2 h-16`，垂直居中）。
- 拉手内含未读亮点（`unreadCount > 0` 时显示金色小圆点）。
- 展开时拉手仍在原位，图标切换为 `PanelLeftClose`，点击收起。
- 面板动效、220px、半透明背景、blur 全部沿用。

- [ ] **Step 4: 更新窄屏浮动按钮徽标数据源**

窄屏分支（原第 149-218 行，现因上面替换而顺移）中，浮动按钮的徽标当前用 `logs.length`。找到窄屏浮动按钮内的徽标（`{hasLogs && (...)}` 块），把其中的 `{logs.length}` 改为 `{unreadBadge}`：

找到：

```tsx
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
```

改为：

```tsx
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
```

注：窄屏 header 内的计数标签保持 `logs.length`（总记录数），不动。

- [ ] **Step 5: 运行 lint + build 确认无类型/语法错误**

Run: `cd app && rtk pnpm lint`
Expected: 无错误。

Run: `cd app && rtk pnpm build`
Expected: 类型检查通过，构建成功。

- [ ] **Step 6: 运行测试确认无回归**

Run: `cd app && rtk pnpm test`
Expected: 全部通过。

- [ ] **Step 7: 手动验证（rtk pnpm dev）**

启动 `cd app && rtk pnpm dev`，进入对战页面，逐项验证：

1. **收起态**：左侧仅一条 8px 窄拉手，垂直居中；无未读时拉手无亮点；游戏区未被挤压。
2. **未读亮点**：进行几回合产生日志后（不点拉手），拉手顶部出现金色小圆点。
3. **展开态**：点拉手，220px 半透明浮层从左滑入，覆盖游戏区左侧；游戏区仍可见可操作（可点道具/射击按钮）；无遮罩。
4. **未读高亮**：展开后，未读条目显示类型色微光 + 金色内描边；约一帧后高亮淡出（markLogsRead 触发，unreadCount 归零）。
5. **收起**：再点拉手（现显示 PanelLeftClose 图标），浮层滑出消失；拉手亮点熄灭。
6. **计数徽标**：窄屏（缩窗至 md 以下）左下角浮动按钮徽标显示未读数（`99+` 若超 100）；点开 Sheet 后 header 计数显示总记录数。
7. **边界**：连续产生 >100 条日志（可快速多回合），未读数正确显示 `99+`，旧日志被丢弃后未读数仍基于 id 锚点正确。
8. **清空**：点清空按钮后，logs 清空，亮点熄灭，未读归零。

- [ ] **Step 8: 提交**

```bash
cd D:/code/smallgame/buckshot-roulette
git add app/src/components/GameLogPanel.tsx
git commit -m "feat: convert battle log to floating drawer with minimal handle and unread highlight"
```

---

## Self-Review

**1. Spec coverage:**
- 收起态完全隐藏面板 + 8px 极简拉手垂直居中 → Task 2 Step 3 ✓
- 拉手风格（半透明深色 + 右侧细边框 + hover 高亮）→ Task 2 Step 3 ✓
- 未读亮点（unreadCount > 0，金色 6px）→ Task 2 Step 3 ✓
- 展开态 220px 半透明浮层 + 沿用动效参数 → Task 2 Step 3 ✓
- 不加遮罩、可同时操作 → Task 2 Step 3（无遮罩元素）+ Step 7 验证 ✓
- header/listArea 沿用、不加额外关闭按钮 → Task 2 未改 header/listArea 结构，拉手统一切换 ✓
- store `lastReadLogId` + `markLogsRead` + clearLogs 同步 + initialState 重置 → Task 1 Step 3 ✓
- 派生 unreadCount（findIndex，-1 → 全部未读）→ Task 2 Step 1 ✓
- 展开后 useEffect 调 markLogsRead → Task 2 Step 1 ✓
- 未读高亮（金色微光）→ Task 2 Step 2 ✓
- 计数徽标区分：header 用 logs.length，拉手/窄屏徽标用 unreadCount/99+ → Task 2 Step 4 + header 未改 ✓
- 不改窄屏 Sheet 结构 → Task 2 Step 4 仅改徽标数据源 ✓
- 不改 GameplayScreen / addLog 调用点 → 计划未涉及 ✓
- 验证命令 lint/build/test + 手动 → Task 1 Step 5、Task 2 Step 5-7 ✓

**2. Placeholder scan:** 无 TBD/TODO；每步含完整代码；测试代码完整。✓

**3. Type consistency:** `lastReadLogId: string | null`（Task 1 声明）= Task 2 消费 `useGameStore((s) => s.lastReadLogId)` ✓；`markLogsRead: () => void`（Task 1）= Task 2 `useGameStore((s) => s.markLogsRead)` + `markLogsRead()` 调用 ✓；`unreadCount`/`unreadBadge` 在 Step 1 定义、Step 2/3/4 消费，命名一致 ✓。
