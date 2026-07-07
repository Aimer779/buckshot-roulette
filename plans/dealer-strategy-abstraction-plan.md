# 庄家策略抽象与可选 AI 风格实现计划

## 1. 原始问题与需求

用户观察到当前游戏中的庄家并不是真正的 AI，而是一组写死的规则化逻辑。用户希望：

- **保留原有庄家逻辑**，不破坏现有默认体验。
- **把庄家决策逻辑抽象成可替换的策略接口**，便于后续接入不同的 AI/规则实现。
- **在设置界面提供选择入口**，让玩家可以自行选择庄家的行动风格。
- 所有策略必须在**相同的信息集**下公平竞技：庄家只知道剩余弹壳的统计分布、自己的血量/道具/状态，而**不知道具体弹壳顺序**，避免开透视挂。

## 2. 已分析的项目文件

| 文件 | 关键发现 |
|------|----------|
| `app/src/hooks/useDealerTurn.ts` | 庄家回合执行层。第 60–63 行用 `blankRatio > 0.5` 重新决定射击目标，覆盖了 `dealerDecision()` 返回的射击建议，是一个已知不一致问题。 |
| `app/src/lib/gameEngine.ts` | `dealerDecision()` 是当前的规则化决策函数，按固定优先级（回血 → 手铐 → 锯子 → 电话 → 射击）决策。 |
| `app/src/store/gameStore.ts` | 已有设置持久化模式：`soundEnabled`、`crtEnabled`、`showTutorial`、`itemEffectTipsEnabled` 均通过 localStorage 读写。 |
| `app/src/pages/TitleScreen.tsx` | 设置面板 `SettingsPanel` 是侧滑抽屉形式，已有开关、滑块等控件，可直接扩展下拉/按钮组。 |
| `app/src/hooks/useGameplayController.ts` | 组装 `useDealerTurn` 等 hooks，是控制器层。 |
| `app/src/lib/shellFlow.ts` | 提供 `countShells`、`getRemainingShells`、`getReloadReason` 等纯函数。 |
| `app/src/lib/shotResolution.ts` | 提供 `resolveShotOutcome`，负责射击结果计算。 |
| `app/src/hooks/usePlayerItems.ts` | 庄家道具执行复用了玩家道具的 `executeItemEffect`/`applyItemEffectResult`。 |
| `plans/gameplay-screen-refactor-plan.md` | 已明确把 "Dealer shooting target diverges from `dealerDecision`" 列为已知行为问题。 |

## 3. 接下来需要做的事

1. 定义 `DealerStrategy` 接口与上下文类型。
2. 把现有**实际执行的**庄家逻辑提取为 `BalancedDealerStrategy`（默认）。
3. 新增 `AggressiveDealerStrategy` 和 `ConservativeDealerStrategy` 两种风格实现。
4. 在 Zustand store 增加 `dealerStrategyId` 字段及持久化读写。
5. 在 `TitleScreen.tsx` 的设置面板加入策略选择 UI。
6. 修改 `useDealerTurn.ts`，使用当前选中的策略对象做完整决策，并消除射击目标的二次计算；同时限定每回合最多使用一个道具。
7. 建立策略注册表，便于后续扩展。
8. 为策略逻辑编写单元测试。
9. 运行 `lint`、`build`、`test` 验证。

## 4. 实现思路与逻辑

### 4.1 接口设计

新增 `app/src/lib/dealerStrategies/types.ts`：

```ts
export interface DealerContext {
  dealerHP: number;
  playerHP: number;        // 当前 Balanced/Aggressive/Conservative 可能不用，但为期望效用型策略预留
  dealerMaxHP: number;
  liveCount: number;
  blankCount: number;
  shellsRemaining: number;
  dealerItems: Item[];
  dealerSawActive: boolean;
  guillotineTriggered: boolean;
}

export interface DealerDecision {
  action: 'shoot-self' | 'shoot-player' | 'use-item';
  itemId?: string;
  reasoning: string;
}

export interface DealerStrategy {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  decide(ctx: DealerContext): DealerDecision;
}
```

### 4.2 策略实现

新建目录 `app/src/lib/dealerStrategies/`，每个策略一个文件：

- `balancedStrategy.ts`：默认策略。道具优先级复刻当前 `dealerDecision`（cigarette → handcuffs → handsaw → phone）。射击决策复刻**实际生效的** `blankRatio > 0.5` 规则，即空包占优时打自己，否则打玩家。注意：原 `dealerDecision` 中 50/50 时的 `Math.random() < 0.45` coin-flip 分支不再迁移——由于实际执行的是 `blankRatio > 0.5`，该分支本就是死代码；新实现下 50/50 确定性地 `shoot-player`。这是相对死代码的有意收紧，并非行为回归。
- `aggressiveStrategy.ts`：激进型。道具优先级与 balanced 相同，但射击阈值更偏攻击——只有当空包比例明显高于实弹（如 ≥ 60%）时才打自己；即使 live 比例不占优（如 40%）也更倾向攻击玩家。
- `conservativeStrategy.ts`：保守型。道具优先级与 balanced 相同，但射击阈值更偏自保——只要空包比例不低（如 ≥ 40%）就倾向于打自己，只有 live 比例明显占优（如 ≥ 60%）才攻击玩家。

三种策略共享完全相同的信息集（只看剩余弹壳统计、血量、道具），不知道具体弹壳顺序。本轮三种策略的**道具优先级完全相同**，风格差异只体现在射击阈值上；道具行为的差异化（如激进型更早用 handsaw、保守型更早用 cigarette）留作后续扩展。

### 4.3 策略注册表

`app/src/lib/dealerStrategies/index.ts`：

```ts
export const DEALER_STRATEGIES: DealerStrategy[] = [
  balancedStrategy,
  aggressiveStrategy,
  conservativeStrategy,
];

export function getStrategyById(id: string): DealerStrategy {
  return DEALER_STRATEGIES.find((s) => s.id === id) ?? balancedStrategy;
}
```

### 4.4 Store 变更

在 `app/src/store/gameStore.ts` 中：

- 新增 `dealerStrategyId: string`。
- 新增 `setDealerStrategyId: (id: string) => void`。
- 仿照 `showTutorial`/`itemEffectTipsEnabled` 通过 localStorage 持久化。
- `resetGame` 保留当前选择的策略 id（不重置为默认值）。

### 4.5 UI 变更

在 `app/src/pages/TitleScreen.tsx` 的设置面板 `SettingsPanel` 中增加一个下拉选择或分段按钮组：

- 列出 `DEALER_STRATEGIES`。
- 显示 `name` 和 `description`。
- 选择后调用 `setDealerStrategyId`。

### 4.6 useDealerTurn 改造

`app/src/hooks/useDealerTurn.ts`：

- 从 store 读取 `dealerStrategyId` 并解析为策略对象。
- 在庄家思考阶段调用 `strategy.decide(ctx)` 获得完整决策。
- 如果决策是 `shoot-self` 或 `shoot-player`，直接按决策执行，**不再用 `blankRatio > 0.5` 覆盖**。
- 如果决策是 `use-item`，执行该道具后调用 `executeDealerShoot()` 射击（保留原有的 ~1200ms 延迟），不再重新调用 `decide`。
  - 保持与原行为一致：每回合庄家**最多使用一个道具**，然后必须射击。
  - 避免引入道具链式使用或无限递归。
- 决策结果（含射击目标）作为参数传入 `executeDealerShoot`，而不是在射击函数内部重读 store 重新推导目标。这样决策与执行穿过 2–3s 思考延迟后仍保持一致，避免在延迟期间状态变化导致的漂移。

这一步同时修复 plans 中记录的 "dealer shooting target diverges from `dealerDecision`" 问题。

### 4.7 涉及文件

**新建：**

- `app/src/lib/dealerStrategies/types.ts`
- `app/src/lib/dealerStrategies/balancedStrategy.ts`
- `app/src/lib/dealerStrategies/aggressiveStrategy.ts`
- `app/src/lib/dealerStrategies/conservativeStrategy.ts`
- `app/src/lib/dealerStrategies/index.ts`
- `app/src/lib/dealerStrategies/__tests__/dealerStrategies.test.ts`

**修改：**

- `app/src/lib/gameEngine.ts`（移除或弃用 `dealerDecision`，保留兼容性包装）
- `app/src/store/gameStore.ts`
- `app/src/hooks/useDealerTurn.ts`
- `app/src/pages/TitleScreen.tsx`

## 5. 验收方案（BDD）

### 5.1 策略可发现与可替换

- **Given** 已注册 `balanced`、`aggressive`、`conservative` 三种策略
- **When** 调用 `getStrategyById('aggressive')`
- **Then** 返回 aggressive 策略实例，且其 `id`、`name`、`decide` 行为与 balanced 不同

### 5.2 设置持久化

- **Given** 玩家在设置面板选择 "激进型"
- **When** 刷新页面后重新打开设置
- **Then** 设置面板仍显示 "激进型"，且新游戏庄家使用激进策略

### 5.3 庄家行为遵循所选策略

- **Given** 当前策略为 Conservative
- **When** 庄家回合且空包比例为 40%（如 2 空 3 实）
- **Then** 庄家倾向于打自己，而非攻击玩家

### 5.4 消除决策覆盖

- **Given** 当前策略返回 `shoot-player`
- **When** 庄家执行射击
- **Then** 实际射击目标必须是玩家，不再被 `blankRatio > 0.5` 逻辑覆盖

### 5.5 原行为保留

- **Given** 当前策略为 Balanced
- **When** 在典型状态（半血、空包比例 60% 以上、无道具）下调用 `decide`
- **Then** 射击决策与当前实际执行的 `blankRatio > 0.5` 规则一致（空包占优则 shoot-self）

### 5.6 不同策略风格差异化

- **Given** 固定状态：庄家 2 血、玩家 3 血、剩余 2 空 2 实、无道具
- **When** 分别用 Balanced、Aggressive、Conservative 决策
- **Then** Balanced 必定 shoot-player；Aggressive 必定 shoot-player；Conservative 必定 shoot-self

### 5.7 设置面板可访问

- **Given** 玩家在标题页
- **When** 点击 "设置" 按钮
- **Then** 设置面板中出现 "庄家风格" 选项，且可交互

### 5.8 构建与测试

- **Given** 完成代码修改
- **When** 运行 `rtk pnpm lint`、`rtk pnpm build`、`rtk pnpm test`
- **Then** 三个命令均通过，无新增类型错误

---

## 方案选项

### 方案 A：多种风格策略（推荐）

按上述计划实现 `Balanced`、`Aggressive`、`Conservative` 三种可切换策略，并在标题页设置面板暴露选择。优点：设置入口有意义，玩家能立刻感受到不同对手风格，且为后续接入更复杂 AI 预留接口。

### 方案 B：最小抽象

只定义 `DealerStrategy` 接口，把当前 `dealerDecision` 作为唯一实现迁移进去，不在设置面板暴露选择。优点：改动最小；缺点：玩家无法选择，设置里只是为将来占了一个扩展位。
