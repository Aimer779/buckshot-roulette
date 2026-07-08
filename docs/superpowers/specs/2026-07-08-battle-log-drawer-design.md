# 设计：战斗记录改为浮层抽屉式（左缘拉手）

**日期**：2026-07-08
**状态**：已批准，待实现
**涉及文件**：`app/src/components/GameLogPanel.tsx`、`app/src/store/gameStore.ts`

## 1. 背景与目标

对战页面左侧的战斗记录当前是"常驻 40px 竖条按钮 + 滑入 220px 面板"的抽屉式叠加（`absolute` 定位，不挤压游戏区）。问题在于收起态仍常驻一个 40px 竖条，占用视觉空间；且无未读提示，玩家难以感知"有新日志"。

**目标**：收起态完全隐藏面板，仅留极简拉手；新增未读提示（拉手亮点 + 面板内未读高亮）；展开时叠加覆盖、不挤压游戏区、不加遮罩、可同时操作游戏。窄屏沿用现有 Sheet 方案不变。

## 2. 收起态（默认）

- 整个面板完全不可见，不再占用左侧 40px 竖条。
- 左缘垂直中部保留一个**极简拉手**：宽约 8px、高约 64px，贴 `left-0`，`top-1/2 -translate-y-1/2`。
- 拉手风格：半透明深色底 `rgba(10,10,15,0.6)` + 右侧细边框（与面板边框一致），`hover:bg-white/10` 高亮。
- **未读亮点**：`unreadCount > 0` 时，拉手顶部显示约 6px 亮点（`var(--accent-gold)`）；无未读时不显示任何标记。

## 3. 展开态

- 从左侧滑入 220px 半透明浮层（`rgba(10,10,15,0.9)` + `blur(8px)`），framer-motion `width` 动画进出，沿用现有动效参数（`duration: 0.25, ease: [0.16,1,0.3,1]`）。
- **不加背景遮罩**，游戏区保持可见且可操作。
- 面板内部结构沿用现有 `header`（标题 + 计数 + 清空按钮）和 `listArea`（滚动日志列表），不改版式。
- 拉手在展开时变为收起手柄：位置/宽度不变（8px），hover 同样高亮；点击它切换收起。**不在面板内另加关闭按钮**，入口/出口统一用拉手。

## 4. 未读机制（核心）

采用"日志 id 锚点"方案，未读数与未读高亮同源、永远一致。

### store 变更（`gameStore.ts`）

- 新增字段：`lastReadLogId: string | null`（初始 `null`，表示全部未读）。
- **不新增** `unreadLogs` 计数字段。
- `addLog`：不做未读相关累加（新条目天然比 `lastReadLogId` 更新，即为未读）。
- 新增 action `markLogsRead()`：`set({ lastReadLogId: get().logs[0]?.id ?? null })`。
- `clearLogs`：改为 `set({ logs: [], lastReadLogId: null })`。
- `resetGame`：通过 `...initialState` 自然重置（`initialState` 含 `lastReadLogId: null`），无需额外追加。

### 组件派生（`GameLogPanel.tsx`）

- `const unreadCount = (() => { const idx = logs.findIndex(l => l.id === lastReadLogId); return idx === -1 ? logs.length : idx; })();`
  - `idx === -1`（lastReadLogId 不在当前 logs 中，例如旧日志被 slice 丢弃）→ 全部未读。
  - `idx >= 0` → 前 `idx` 条为未读。
- 拉手未读亮点：`unreadCount > 0` 时显示。
- **计数徽标区分两种语义**：
  - 面板 header 内的计数标签：保持显示**总记录数** `logs.length`（展开后未读清零，若显示 unreadCount 会变成 0 而面板里有日志，产生误导）。
  - 拉手顶部亮点 + 窄屏浮动按钮徽标：显示**未读数** `unreadCount`，`>= 100` 显示 `99+`（日志 slice 上限 100）。
- 列表渲染：每条 log 判断是否未读（index < unreadCount，或等价地 id 比 lastReadLogId 更新），未读条目加高亮背景（`rgba(212,165,32,0.28)` 金色微光）。
- 展开后 `useEffect`（依赖 `collapsed`）：当 `collapsed` 变 `false` 时调 `markLogsRead()`，高亮随后消失，条目保留。

## 5. 文件改动范围

仅两处：

1. **`app/src/components/GameLogPanel.tsx`**：
   - 重写宽屏分支：收起态隐藏 40px 竖条，改为左缘极简拉手（8px×64px，垂直居中）；拉手顶部未读亮点；展开态沿用 220px 面板动效；加 `markLogsRead` 的 effect；列表条目加未读高亮；计数徽标基于派生 `unreadCount`。
   - 窄屏分支：沿用现有 Sheet 方案，仅把浮动按钮徽标改为基于派生 `unreadCount`（`99+`）；Sheet 内 header 计数标签保持 `logs.length`。
2. **`app/src/store/gameStore.ts`**：加 `lastReadLogId` 字段、`markLogsRead` action、`addLog`/`clearLogs`/`resetGame` 同步、类型声明。

`GameplayScreen.tsx` 不动（`<GameLogPanel />` 仍在原 `relative flex-1 flex overflow-hidden` 容器内，absolute 定位适用）。

## 6. 非目标 / 不做

- 不改窄屏 Sheet 方案结构。
- 不改日志数据结构、渲染字号、类型颜色映射。
- 不改面板宽度（220px）、动画参数。
- 不加背景遮罩、不加面板内额外关闭按钮。
- 不改日志写入来源（hooks/store 各处 `addLog` 调用点不变，仅 `addLog` 内部行为不变——不再做未读累加）。
- 不显示时间戳（本游戏每条间隔几秒，噪声大；已选"未读高亮"方案）。

## 7. 验证

- `rtk pnpm lint && rtk pnpm build && rtk pnpm test`。
- 手动：
  - 收起态：拉手极简（8px），有新日志时顶部亮点亮；无未读时无标记。
  - 展开态：220px 浮层从左滑入覆盖，游戏区可操作，无遮罩；未读条目金色高亮；展开后高亮消失、亮点熄灭、计数归零。
  - 边界：日志超 100 条被 slice 丢弃旧条目后，未读数仍正确（基于 id 锚点）；`clearLogs`/`resetGame` 后 `lastReadLogId=null`、全部视为未读。
  - 窄屏：Sheet 行为不变，计数徽标显示 `unreadCount`/`99+`。
  - 回合切换、道具、射击、手铐跳过等流程的日志写入与显示正常。

## 8. 设计决策记录

- **默认收起**：战斗记录是回顾性辅助信息，默认展开会持续遮挡左侧游戏内容，破坏对战紧张感；配未读提示解决"不知道有新日志"问题。
- **左缘中部极简拉手**：贴边但极窄（8px），存在感最低，把空间还给游戏区；垂直中部便于定位。
- **无遮罩可同时操作**：日志查看不应中断对战节奏。
- **未读 id 锚点方案**：未读数与高亮同源一致，避免计数/切片不同步的脆弱性；日志被 slice 丢弃旧条目也不影响正确性。
- **不显示时间戳**：每条间隔短，时间戳噪声大于信息量；未读高亮已足够定位新内容。
