# Jev 模式接入计划（推荐方案）

> 状态：调研完成，待实现。
> 依据：TypeSafe 官方文档（2026-09）、OpenRouter Decisions API、仓库内 `jev-buckshot-demo.zip`、当前 `dealerStrategies` / `useDealerTurn` / `server/http.ts`。

## 1. Jev 是什么（和 LLM 的差别）

Jev 是 TypeSafe 的 **System One** 模型，不是聊天模型。

- 输入：一段 `state`（字符串 / JSON）+ 一组预先写好的 **typed questions**
- 输出：带校准概率的结构化答案，**不生成文本、不解释、不 hallucinate 选项**
- 三种问题原语（可在同一次请求里并行问多题）：

| 类型 | 问什么 | 返回 |
|------|--------|------|
| Choice | 从你给出的封闭选项里选一个 | `choice`, `probabilities`, `confidence` |
| Score | 在你定义的有序量表上打分 | `score`（可落在两档之间）, `legend`, `probabilities`, `confidence` |
| Noul | 是/否 | `noul` ∈ [0, 1] |

官方强调三条实现纪律：

1. **代码掌控流程**。Jev 只回答窄问题，不规划回合。
2. **同一请求里的问题彼此独立**。A 题的答案不是 B 题的输入。要组合，在你的代码里做。
3. **用 confidence 做门控**。低置信度时回退到规则 / 人，而不是硬吃 argmax。

这和恶魔轮盘高度契合：动作集合封闭、必须公平（不能看隐藏弹序）、庄家已有 2–3 秒「思考中」动画可以盖住 70–500ms 的请求。

## 2. 官方怎么接入

### 2.1 端点（同一请求体，两个入口）

| 入口 | URL | model | 密钥 | 现状 |
|------|-----|-------|------|------|
| TypeSafe 直连 | `POST https://api.typesafe.ai/v1/systemone` | `jev-latest` 或 `jev-1.13.0` | `TYPESAFE_API_KEY` | 早期访问 / waitlist |
| OpenRouter（今晚就能用） | `POST https://openrouter.ai/api/alpha/decisions` | `typesafe/jev-1.13` | `OPENROUTER_API_KEY` | 公开，请求/响应形状与官方一致 |

**不要**把 Jev 打到 `/chat/completions`。OpenRouter 会直接拒绝：这是 decisions 模型。

官方 JS SDK：`@typesafe-ai/sdk` 的 `client.systemOne(...)`。OpenRouter 路径不能只改 `base_url`（SDK 写死 `/v1/systemone`），所以本项目 **v1 用 `fetch` 直打 HTTP**，按环境变量选入口，避免为 demo 再加一个 SDK 依赖。

### 2.2 请求 / 响应骨架

```json
{
  "model": "typesafe/jev-1.13",
  "state": { "...公开对局状态..." },
  "questions": {
    "action": {
      "type": "choice",
      "instructions": "Pick exactly one action from `legalActions`.",
      "criteria": { "shoot-player": "...", "use-handsaw": "..." }
    }
  }
}
```

响应：`{ model, answers: { action: { type, choice, probabilities, confidence } }, usage }`。

价格量级：输入 $0.042 / MTok，输出免费。demo 测算单回合约 $0.00002。上下文 64k / 请求，state + 最长一题 32k。延迟官方宣传 70–500ms。

### 2.3 密钥纪律

密钥只放 Node 服务端（`app/server/` + Vite `configureServer` 中间件已经挂了同一套 `createApiHandler`）。**禁止** `VITE_*`、禁止进浏览器 bundle。

## 3. Demo 能抄什么、不能照搬什么

`jev-buckshot-demo.zip` 是给本仓库写的接入草图，方向对，但不能当最终设计。

### 3.1 值得保留

- 把 Jev 做成第四种庄家风格，挂进已有 `DealerStrategy` 注册表和标题页「庄家风格」下拉框。
- `legalActions(ctx)` 把 Choice 的选项收成当前合法动作，避免模型「发明」没有的道具。
- 服务端代理 + 2.5s 超时 + 无 key / 失败时回退。
- 思考动画盖住网络延迟。
- HUD 需要的概率条 / live belief / latency 数据结构。

### 3.2 不要照搬的点

| Demo 做法 | 问题 | 本项目该怎么做 |
|-----------|------|----------------|
| `decide(ctx): DealerDecision \| Promise<...>` | `resolveDealerTurnDecision` 会 **同步调用 `decide` 两次**（一次取道具，一次模拟消耗后再取射击目标）。Jev 化之后会变成两次 API 往返。 | Jev 路径 **一次请求** 同时问 `action` 和 `shoot_target`，由代码合成 `DealerTurnDecision`。规则策略保持同步 `decide`。 |
| `should_commit` Noul：「选中的动作是否明显更好」 | 官方：**同请求内答案互相不可见**。这题看不到 `action` 的选择，是装饰性的。 | 删掉。用 `answers.action.confidence` 做门控（官方 Confidence-Gated Routing）。 |
| 只把 `DealerContext` 原样塞进 state | 当前 context 没有 `playerItems`、没有庄家私有情报、没有「玩家已被铐」。肾上腺素 / 手铐合法性不完整。 | 扩展发给 Jev 的 **公开 state**（见 §5.3），弹序仍然永不发送。 |
| 合法动作阈值与 `_helpers.ts` 不一致 | 例如手铐：demo `shellsRemaining > 1`，现规则 `> 2`。 | 抽一份共享的 `legalDealerActions(ctx)`，规则策略和 Jev 共用。 |
| 庄家用电话 / 放大镜没有记忆 | `itemEffects.ts` 里庄家用电话只消耗不揭示；放大镜不进庄家奖池（注释：AI 还不会用私有信息）。 | v1 先不发放大镜、电话对庄家仍是弱情报。v2 再加 `dealerKnownShells`。 |
| 独立 `server/jevDealer.mjs` | 本仓库已有 `app/server/http.ts` + Vite 中间件，dev/prod 同一 handler。 | 在 `createApiHandler` 里加 `POST /api/dealer/jev`，不要另起一套服务器。 |
| `readBody` 上限 4096 | Jev 的 state+questions 小局够用，但 criteria 一长就可能顶满。 | 该路由单独放宽（例如 32KB），并校验 schema。 |

另外：当前回合模型是 **每回合最多 1 个道具，然后必须射击**。Demo 也按这个假设。v1 **不要**改成多道具连环（那会变成多轮 Jev 调用，延迟和规则都会变）。

## 4. 推荐架构

```
TitleScreen 庄家风格 = Jev · System One
        │
        ▼
useDealerTurn（DEALER_TURN）
  规则策略：resolveDealerTurnDecision(strategy, ctx)   ← 保持同步
  Jev 策略：setDealerThinking(true)
            与 2–3s 思考动画重叠，fetch POST /api/dealer/jev
            成功且 confidence ≥ 阈值 → 用返回的 DealerTurnDecision
            超时 / 4xx / 低置信 / 非法 choice → balancedStrategy
        │
        ▼
app/server/http.ts  POST /api/dealer/jev
  1. zod 校验公开 ctx（绝不收弹序）
  2. legalDealerActions(ctx) 生成 Choice criteria
  3. callJev（OpenRouter 优先，其次 TypeSafe）
  4. 把 answers 合成 { turn, hud }
  5. 密钥永不回传
```

原则：Jev 是 **顾问**，不是引擎。射击结算、道具效果、弹序、胜负仍走现有 `shotResolution` / `itemEffects` / store。

### 4.1 不要把 `DealerStrategy.decide` 改成一律 async

三个规则策略是纯函数，测试和 `resolveDealerTurnDecision` 的二次模拟都依赖同步。Jev 的网络 I/O 应该走 **单独的 turn 解析路径**：

```ts
export interface DealerStrategy {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  decide(ctx: DealerContext): DealerDecision; // 规则策略；Jev 的 decide 只作 fallback 种子，或不注册这条
}

export async function resolveJevDealerTurn(
  ctx: JevDealerState
): Promise<{ turn: DealerTurnDecision; hud: JevHud }>
```

`useDealerTurn` 按 `dealerStrategyId === 'jev'` 分支。这样规则路径零回归。

### 4.2 一次请求问两道独立 Choice（关键）

```
questions:
  action:        Choice  ← legalActions（含 shoot-self / shoot-player / use-*）
  shoot_target:  Choice  ← { self, player }  仅当 action 是道具时使用
  live_belief:   Score   ← 五档「当前膛更像空/实」，只给 HUD，不参与分支
```

代码合成：

- `action ∈ {shoot-self, shoot-player}` → 直接射击，忽略 `shoot_target`
- `action` 是道具 → `use-item` + `shootTarget` 取自第二题（非法/缺失则按 liveCount 启发式）
- `action.confidence < 0.55`（可调）或 choice 不在 legal set → 整回合回退 balanced

这符合官方「问题独立、代码组合」，也避免第二次 `decide` 调用。

`live_belief` 故意独立：Jev **不会**自动把这题的分数喂给 `action`。要把「膛内信念」写进动作选择，只能写进 `action` 的 `instructions` / `criteria` 和 `state.liveCount/blankCount`。

### 4.3 发给 Jev 的 state（v1）

只发公开信息 + 庄家自己的手牌：

```ts
{
  rules: 'Buckshot Roulette dealer turn. Public shell counts only. Never assume hidden order.',
  round, guillotineTriggered,
  dealerHP, dealerMaxHP, playerHP, playerMaxHP,
  liveCount, blankCount, shellsRemaining,
  dealerItems: type[],          // 不发 id
  playerItems: type[],          // 肾上腺素需要看见桌上有什么
  dealerSawActive,
  playerCuffed: skipPlayerTurn, // 已铐则手铐非法
  legalActions: string[],
}
```

**永不发送** `shells[]` 顺序、`currentShellIndex` 对应的真实类型、玩家放大镜揭示结果。

v2 再加 `dealerKnown`（庄家私有：电话/放大镜记住的位置），玩家 UI 不可见。

### 4.4 合法动作（与现规则对齐后再扩展）

v1 允许 Jev 使用规则策略目前 **不会主动选** 的道具（啤酒、逆变器、过期药、肾上腺素）。这是 Jev 模式的可感知差异。合法性仍由代码裁剪：

- 香烟：未断头台 且 HP < max
- 手铐：未铐玩家 且 shellsRemaining > 2
- 手锯：未激活
- 啤酒 / 逆变器：shellsRemaining > 0
- 电话：shellsRemaining > 2（v1 仍几乎无情报收益，可先从 Choice 里拿掉，避免浪费）
- 过期药：未断头台
- 肾上腺素：玩家桌上有可偷道具
- 放大镜：v1 不进入奖池，也不进 Choice

非法 choice 一律丢弃并回退。

### 4.5 服务端

在现有 `createApiHandler` 增加：

- `POST /api/dealer/jev`
- 同源检查（已有）
- IP 速率限制（可复用 rooms 那套，阈值更松，例如 30/min）
- body ≤ 32KB，zod schema
- `AbortController` 2500ms
- Provider：`OPENROUTER_API_KEY` → OpenRouter；否则 `TYPESAFE_API_KEY` → TypeSafe；都没有 → `{ ok: false, reason: 'no-key' }`，客户端回退
- 响应只含 `turn` + `hud`（概率、confidence、latency、model、fallback），不含 raw key / 完整上游错误体

Dev：Vite `configureServer` 已经把 `/api/*` 交给同一 handler，**不用改 vite.config**。
Prod：`app/server/index.ts` 同样走 `createApiHandler`。

环境变量放 `app/.env.local`（gitignore），README 补两行。

### 4.6 客户端体验

- 设置下拉新增 `Jev · System One`，说明：「实时决策模型，只在合法动作里选，失败回退均衡型。」
- 思考中：现有 `dealerThinking` 保留。
- 可选 HUD（建议 v1 就做最小版）：战斗日志写一行 `Jev 选择 手锯 · 置信 0.78 · 142ms`；若有余力，在庄家区域叠一条概率条。
- 无密钥 / 回退：日志 `Jev 不可用，回退均衡型`，游戏不卡死。
- **仅本地 PvE**。联机是玩家对玩家，不走庄家策略。

### 4.7 不采用的方案

| 方案 | 为何不选 |
|------|----------|
| 浏览器直连 Jev | 密钥泄露；CORS；可被刷配额 |
| 用 Grok / 其它 LLM 生成 JSON 再 parse | 用户要的是 Jev 模式；LLM 会幻觉动作、没有校准概率、延迟高。Jev 不是「换个 chat 模型」 |
| 把 `decide` 全部改 async | 规则策略和现有测试无必要承担 Promise 税 |
| 每道具一轮 Jev、允许多道具 | 改变现有回合节奏，延迟叠加，v1 范围过大 |
| 复合选项 `use-saw-then-shoot-player` | Choice 选项组合爆炸 |
| 给每条合法动作各问一个 Noul 再在代码里 argmax | 比单 Choice 更碎，官方对「互斥选一个」明确推荐 Choice |
| 引入 `@typesafe-ai/sdk` | v1 要同时打 OpenRouter，SDK 绑死 TypeSafe 路径 |

## 5. 实现步骤

### PR 1 — 纯函数与服务端代理（不改对局手感）

- `app/src/lib/dealerStrategies/legalActions.ts`：共享合法性
- `app/src/lib/dealerStrategies/jev/buildJevRequest.ts` + `answersToDecision.ts`（可被 Node 和测试 import；注意 Vite 客户端不要 import 含 `process.env` 密钥的模块——请求构建可以纯函数，真正的 fetch 只放 server）
- `app/server/jev.ts`：`callJev`、mock 形状、超时
- `app/server/http.ts`：`POST /api/dealer/jev`
- 单测：合法性、非法 choice 钳制、confidence 回退、无 key 形状
- 手工：`OPENROUTER_API_KEY=...` 打一回合真实响应（可用 demo 的 `one-turn.mjs` 思路写进 `app/server` 的脚本，或 vitest skip-if-no-key）

### PR 2 — 接到庄家回合

- `types.ts` 保持 `decide` 同步
- `index.ts` 注册 `jev` 元数据（id/name/description），`getStrategyById('jev')` 返回的 `decide` 直接代理 balanced，防止有人误调
- `useDealerTurn.ts`：Jev 分支 `await fetch('/api/dealer/jev')`，与思考 timeout 并行（`Promise.all` 思考 delay 和请求，取较晚者，上限 ~3s）
- `TitleScreen` 下拉自动出现（读注册表）
- 失败回退 balanced，写 log
- 测：mock fetch；超时回退；choice 不在 legal set

### PR 3 — HUD（小而可见）

- `JevHud` 写入本回合 log / 可选庄家侧概率条
- 显示：所选动作、各动作概率、live belief、confidence、latency、是否 fallback
- 仅 Jev 风格且本回合真正打过 API 时显示

### PR 4 — 可选增强（不要和 v1 绑在一起）

- store 增加 `dealerKnownShells`（对玩家隐藏）
- 庄家电话 / 放大镜写入该结构，Jev state 带上
- Jev 模式下把 magnifier 加回庄家奖池
- 评估是否允许「道具后若 Jev 还想用药」的第二跳（默认否）

## 6. 风险与验收

- **公平性**：单测禁止 request builder 读取 `shells` 数组。Code review 盯 state。
- **卡死**：任何网络失败都必须在思考动画结束前落到射击或用药，不能挂在 DEALER_TURN。
- **规则回归**：非 Jev 风格的现有测试必须全绿；`resolveDealerTurnDecision` 签名不改。
- **联机**：Jev 选项只影响本地 `dealerStrategyId`，`app/server/match.ts` 不引用。
- **手感**：同一残局（3 实 2 空、手锯+香烟）Jev 应能选出规则策略不会选的动作（例如先锯再打），这是模式存在的意义。
- **无 key 可玩**：没配密钥时选 Jev = 均衡型 + 一条提示，不能白屏。
- 命令：`rtk pnpm lint` / `build` / `test`，再在 `rtk pnpm dev` 里打一局 Jev 与一局均衡型。

## 7. 开放问题（实现前可拍板，有默认值）

1. **置信度阈值**：默认 0.55，低于则整回合回退。可做成常量，不必先上设置项。
2. **v1 要不要让 Jev 选电话**：默认 **不选**（庄家用了没情报）。等 PR 4。
3. **HUD 强度**：默认战斗日志一行；概率条作为同一 PR 的可选 UI。
4. **密钥来源**：默认 OpenRouter，文档写 waitlist 后可切 TypeSafe。
