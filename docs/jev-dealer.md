# Jev 庄家政策参考（审核用）

> 政策版本：`jev-policy-v3`  
> 钉死模型：TypeSafe `jev-1.13.0` / OpenRouter `typesafe/jev-1.13`  
> 状态：已接入本地 PvE。联机 PvP 不走这条路径。  
> 目的：给审核者一份「现在怎么接、为什么这样接、哪里还可以更好」的材料。

请带着这个问题读：Jev 的权重我们调不了。能变强的只有四样——**代码算出来的事实、问题怎么拆、答案怎么合成、以及用日志量什么**。

术语：`DealerTurnDecision.target` / `shootTarget` 为 `'dealer'` 时，含义是**打玩家**（`useDealerTurn.ts` 里 `outcomeTarget = target === 'self' ? 'dealer' : 'player'`）。文档用「打玩家」；读 compose / forced 源码时不要把它理解成打自己。

---

## 1. Jev 是什么，以及明确不是什么

Jev 是 TypeSafe 的 System One 模型：输入一段 `state` + 一组预先写好的 typed questions，一次前向并行返回校准过的结构化答案。不生成文本，不解释，不发明选项。

三种原语：

| 类型 | 问什么 | 返回 |
|------|--------|------|
| Choice | 从你给的封闭选项里选一个 | `choice` + `probabilities` + `confidence` |
| Score | 在有序量表上打分 | `score`（可落在两档之间） |
| Noul | 是/否 | `noul` ∈ [0, 1] |

官方纪律：

1. **代码掌控流程。** Jev 只回答窄问题，不规划整回合。
2. **同一请求里的问题彼此独立。** A 的答案不是 B 的输入。要组合，在代码里做。
3. **Jev 不会算数。** TypeSafe 把计数/比例/比较列为 1.13 的失败模式（官方「Math and Numbers」jaggedness）。象棋社区有一组对照：**只给棋盘走子很差；代码先算好吃子/悬子再塞进 state 才明显好转**。文中「约 950 Elo」来自第三方转述，**本仓库未核到原始实验报告**，二审请当轶事而非计量。扑克同理：牌面数字本身不够，把「你现在落后 / 0 张 outs」算好写进去，决策才会翻面。

因此：**有精确答案的东西全部在代码里算，只把事实递给它。** 恶魔轮盘比象棋更适合这句话——公开弹数的期望伤害本来就能算。

Jev 也**不是**：

- 聊天模型 / 可微调权重的分类头
- 自对弈训练器（两边都用 Jev 对打，只是局面生成器）
- 可以放心把 `noul = 0.7` 当成「70% 实弹」的概率计。社区复测倾向于把它当**单调分数**，在自己的数据上再拟合一层校准。当前膛是实弹的先验本来就等于 `liveRatio`，所以有意思的量是 **`noul − liveRatio`（偏离）**，不是把 0.7 当 70%。

---

## 2. 接入边界

| 项 | 现状 |
|----|------|
| 用途 | 仅本地 PvE 庄家。设置里第四种风格 `Jev · System One` |
| 密钥 | 只在 Node 服务端。`TYPESAFE_API_KEY` 优先，`OPENROUTER_API_KEY` 备用。禁止 `VITE_` |
| 端点 | TypeSafe `POST https://api.typesafe.ai/v1/systemone`。OpenRouter 代码用 `POST https://openrouter.ai/api/alpha/decisions`；官方 API reference 的 curl 另有一处写成 `https://openrouter.ai/api/v1/api/alpha/decisions`。**以实打一次为准**（有 OpenRouter key 时验 200 即可） |
| 模型钉死 | 请求发 `jev-1.13.0` / `typesafe/jev-1.13`。响应会回显真实 `model`；若与 pin 对不上，日志打 `modelDrift: true`。可用 `JEV_MODEL` 覆盖 |
| 公平性 | **只约束模型输入**：请求永不发送 `shells[]` 顺序。庄家放大镜写入 `dealerKnownChamber`，玩家 UI 不渲染。`shells[]` 和 `dealerKnownChamber` 仍在玩家浏览器的 Zustand 里，DevTools 看得见。**本地 PvE 不承诺防作弊** |
| 入口防护 | `POST /api/dealer/jev` 同源检查 + zod `.strict()` + 32KB + 30 req/min/IP（`server/http.ts`） |
| 回合节奏 | 仍是「最多 1 个道具，然后必须射击」。道具后对**膛内变化类**（放大镜/啤酒/逆变器）会在本地重算射击目标 |
| 失败 | 无 key / 超时 / 网络失败 → 回退均衡型。合成层不再因「一个大 Choice 置信低」整回合作废 |

怎么跑：`app/.env.example` 填 key；pnpm 11 用 `app/pnpm-workspace.yaml` 的 `verifyDepsBeforeRun: false` 和 `allowBuilds.esbuild`，与 Jev 政策无关。

---

## 3. 当前流水线（v3）

```
DEALER_TURN
  └─ POST /api/dealer/jev   （客户端不再短路 forced，好让服务端打日志）
        ├─ 规则层 forced（已知弹 / 全实 / 全空）→ 直接返回，不打模型
        ├─ 无 key → fallback balanced
        ├─ state.facts + 原子 Noul → 代码合成 compose
        └─ 一行 JSON 日志（forced / jev / fallback 都会打）
```

射击目标：`DealerTurnDecision.target === 'dealer'` 表示打玩家。

### 3.1 规则层（Jev 碰不到）

文件：`app/src/lib/dealerStrategies/jev/forced.ts`

`inferredKnownChamber`（`facts.ts`）来源：

- 庄家私有 `knownChamber`（放大镜，`gameStore.dealerKnownChamber`）
- 或公开计数已确定：`blankCount === 0` → 实弹；`liveCount === 0` → 空包

闭式解：

| 局面 | 动作 | reason |
|------|------|--------|
| 已知空包 | 对自己开枪 | `known-blank` |
| 已知实弹 + 手铐合法 + 对方一枪能打死我 | 上手铐，然后打玩家 | `known-live-cuff` |
| 已知实弹 + 有锯 + 玩家 HP > 1 | 上手锯，然后打玩家 | `known-live-saw` |
| 已知实弹否则 | 打玩家（1 血不浪费锯） | `known-live` |

「对方能打死我」：`dealerHP <= (玩家有锯或锯已激活 ? 2 : 1)`。

未写死：已知空包 + 逆变器改打对手（一回合一个道具）。

### 3.2 预计算 facts

文件：`app/src/lib/dealerStrategies/jev/facts.ts`

```
liveRatio, blankRatio, knownChamber,
lethalIfLive, selfDiesIfLive, extraTurnValue,
infoItemsLeft, healLegal, sawLegal, cuffLegal, invertLegal, magnifierLegal
```

`liveCount` / `blankCount` 仍在 facts 里作核对。instructions 要求用 `liveRatio`，不要重算。

注意：`selfDiesIfLive` 目前按**自己的锯伤害**算（自己打自己），和 forced 层「对方打我会不会死」不是同一个量。合成层的 `opponent_can_kill_next` Noul 才覆盖后者。

### 3.3 原子问题（并行 Noul）

文件：`app/src/lib/dealerStrategies/jev/buildJevRequest.ts`

不再问「下一步做什么」这一个大 Choice。v1 把开枪和所有道具混在一个 Choice 里，3 实 2 空上手锯时概率摊开、置信 0.07–0.12，被全局 0.55 砍掉。

| id | 何时问 | 含义 |
|----|--------|------|
| `chamber_likely_live` | 总是 | 当前膛是实弹吗（只看 facts） |
| `opponent_can_kill_next` | 总是 | 对方拿到下一回合，这轮装弹里能否打死自己 |
| `should_heal` | `healLegal` | 这回合要不要抽香烟 |
| `should_spend_info` | 未知弹且有放大镜或啤酒 | 射击前值不值得花信息道具 |
| `should_double` | 手锯合法 | 下一枪前要不要锯 |
| `should_deny_turn` | 手铐合法 | 现在上手铐值不值得 |
| `should_invert` | 未知弹且有逆变器 | 反转是否优于原样打 |

手机不进合法动作：庄家电话还没有未来弹私有记忆。

肾上腺素 / 过期药：**不进合法动作**，因为 `itemEffects.ts` 对庄家 `return null`（`DEALER_PLAYER_ONLY_ITEM_TYPES`）。这不是「合成惰性」，是契约：`legalDealerActions` 必须与 `executeItemEffect` 可执行集合对齐。

### 3.4 合成顺序（字典序链，不是效用最大）

文件：`app/src/lib/dealerStrategies/jev/compose.ts`  
阈值：`app/src/lib/dealerStrategies/jev/policy.ts` 的 `JEV_THRESHOLDS`  
**默认 shootT**：`JEV_THRESHOLDS.shoot === 0.55`，由 `JEV_CONFIDENCE_THRESHOLD` 别名；设置滑条 `jevConfidenceMin` 覆盖。

```
healT              0.55
infoT              0.50
opponentCanKill    0.65  → 手铐提前到锯之前
sawT               0.55  且 chamber_likely_live > 0.55
cuffT              0.60
invertT            0.70
shootT             滑条，默认 0.55
```

这是**字典序**：一个道具槽被「回血」占了，就不会再权衡「回血 1」vs「锯 +1 伤害」。这与 §1「有精确答案的在代码里算」并不完全一致——更彻底的做法是对每个合法动作算代码期望值，只在算不出来的地方信 Noul。

Noul 缺失时，`chamber_likely_live` 回退到 `liveRatio`，其它当 0。  
**只要 Noul 存在，liveBelief 就是 Noul，不是 liveRatio。** 把滑条改成 0.50 并不等于「直接信 liveRatio 的方向」。

**已知弹在回合开始时不进合成层**（走 forced）。放大镜 / 啤酒 / 逆变器会在**道具之后**改膛内事实；客户端在开枪前对这三类做本地 `retargetAfterItem`（`jev/retarget.ts`）：

- 放大镜后 `dealerKnownChamber` 已知 → 再跑 forced 闭式解决定方向
- 啤酒后按新计数 / forced 重算方向
- 逆变器：已知则走 forced；未知则把道具前的射击目标对调（先验 `p` 变成 `1-p`）

香烟 / 手铐 / 手锯不重算方向。

### 3.5 日志

`server/jev.ts` 的 `logJevTurn`：**forced、无 key、Jev 合成**三条路径都会打（测试环境 `VITEST` 静默）。

```json
{
  "tag": "jev-turn",
  "policyVersion": "jev-policy-v3",
  "turnId": "jev-…",
  "model": "jev-1.13.0",
  "modelDrift": false,
  "ruleFired": "forced",
  "action": "shoot-self",
  "liveBelief": 0,
  "nouls": {},
  "fallback": false,
  "reason": "known-blank",
  "latencyMs": 0,
  "round": 2,
  "shellsRemaining": 5,
  "liveCount": 3,
  "blankCount": 2,
  "shootT": 0.55,
  "knownChamber": null
}
```

`ruleFired`：`forced` | `jev` | `fallback`。

`turnId` 由客户端生成、请求带上、日志回显。事后标签 **不必等服务端回填**：真相在客户端——`shells[]` 和 `resolveShotOutcome` 的 `shellType`（`shotResolution.ts`）可以直接打 `revealedShell`。定义：**这一回合离开膛室的那一发**（开了或被啤酒弹出）才算。还能顺便算 oracle。

还缺、v3d 表格仍然做不完的：客户端把 `revealedShell` / `hpDelta` 按 `turnId` 拼回同一行（现在服务端日志在开枪之前就写完了）。

---

## 4. 文件地图

| 文件 | 职责 |
|------|------|
| `jev/policy.ts` | 版本号、钉死的 model id、`JEV_THRESHOLDS`（含默认 shootT 0.55）、`clampJevConfidenceMin`、`modelLooksPinned` |
| `jev/types.ts` | `JevDealerState` / `JevHud` / `NOUL_LABELS`；从 policy 再导出默认阈值 |
| `jev/facts.ts` | 预计算 + 从计数/偷看推断 knownChamber |
| `jev/forced.ts` | 已知弹闭式解（枪 / 锯 / 手铐） |
| `jev/buildJevRequest.ts` | facts + 原子 Noul |
| `jev/compose.ts` | Noul → 一个合法动作（字典序） |
| `jev/retarget.ts` | 放大镜/啤酒/逆变器之后本地重算射击目标 |
| `jev/answersToDecision.ts` | API 失败回退；成功则 compose |
| `jev/client.ts` | 请求整形（不含弹序）+ 本地网络失败回退 |
| `legalActions.ts` | 合法性真源，须与 `itemEffects.executeItemEffect` 可执行集合对齐 |
| `itemEffects.ts` | 庄家可执行：烟/铐/锯/啤酒/放大镜/逆变器。肾上腺素/过期药对庄家 `null` |
| `server/jev.ts` | 双供应商、forced、日志、modelDrift |
| `server/http.ts` | 路由、同源、zod strict、32KB、30/min/IP |
| `hooks/useDealerTurn.ts` | 打 `/api/dealer/jev`，道具后 retarget；`'dealer'` → 打玩家 |
| `hooks/usePlayerItems.ts` | `applyDealerItem`；放大镜写 `dealerKnownChamber` |
| `store/gameStore.ts` | `dealerKnownChamber`、`jevConfidenceMin`（shootT） |
| `components/gameplay/JevDecisionHud.tsx` | 把 noul 画成百分比条（调试向，见 §5） |

---

## 5. 已知缺口（按优先级）

1. **逆变器曾经是活 bug，现已接到执行层。** 原先 `legalActions.ts` / compose 会选出 `use-inverter`，但 `itemEffects.ts` 的 `DEALER_PLAYER_ONLY_ITEM_TYPES` 对庄家 `return null`：不翻弹、不消耗、HUD 却写「Jev · 逆变器」。现已把逆变器放进庄家可执行集合，并在未知膛时翻转射击目标。请回归：日志出现逆变器后，当前弹类型必须翻、道具必须消失。肾上腺素/过期药仍对庄家非法，也已从 `legalDealerActions` 拿掉，避免再分叉。

2. **道具后只做局部重算，没有第二跳 Jev。** `retargetAfterItem` 用 forced / 计数 / 翻转目标，不再问模型。若放大镜后还想「要不要再用药」——当前引擎不允许第二件道具。啤酒弹出的弹型是白拿的公开信息，只用于改射击方向，不会触发新的 Noul。

3. **forced 层已上手铐，但仍很窄。** 已知实弹 + 对方一枪能杀我 → 先铐。已知实弹 + 玩家 1 血 → 不浪费锯。其它「致死局要不要提前锯/开枪」仍在合成字典序里。

4. **日志还拼不出校准表。** 已有 `turnId`、弹数、shootT、knownChamber、ruleFired。缺开枪/弹出后的 `revealedShell` 回写。标签定义：离开膛室的那一发。好消息：客户端已经有真相，不必「服务端回填弹序」。

5. **已知空包 + 逆变器组合未写死。** 与第 1 条不同：那是执行 bug；这是规则层要不要用逆变器把空包变成打人。

6. **手机对庄家仍无情报。** 放大镜已写入 `dealerKnownChamber`。电话需要 `dealerKnownFuture[]`。

7. **一回合一个道具。** 「反转再锯再打」进不了规则层。

8. **HUD 把 noul 显示成百分比**（`JevDecisionHud.tsx`）。方便调试，容易让人以为 0.70 = 70% 实弹。可改成条而不标数字，或标明「未校准分数」。

9. **合成是字典序不是效用最大。** 见 §3.4。§7 不应只问「优先级顺序对不对」，更该问要不要改成代码期望值。

10. **§6 的固定种子对局现在跑不起来。** `loadShells` / `distributeItems` 用 `Math.random()`（`gameEngine.ts`），没有可注入 RNG，也没有先手开关。「200 个 seed + 先手对调」必须先做注入 rng + 首动参数，这是 v3d 的前置依赖，不是现成的。

11. **自对弈不能当训练器。** 两边同一套问题，日志只会强化这套政策爱走的路；胜负被下一发弹型主导。自对弈只适合产局面和校准样本。

---

## 6. 建议的下一刀（一次只拧一颗螺丝）

对照一定要有「看见下一发的 oracle」。

| 版本 | 只改一类 | 依赖 | 怎么验收 |
|------|----------|------|----------|
| v3a（已做） | facts 预计算 | — | 请求体无 `shells` 顺序；`liveRatio` 由代码算 |
| v3b（已做） | 大 Choice → 原子 Noul | — | 3 实 2 空上手锯不再因置信 0.12 整回合回退 |
| v3c（部分） | 已知弹硬规则 + 手铐/不浪费锯 | — | 全实/全空/偷看走 forced；空包+逆变器未做 |
| v3c2（已做） | 执行契约对齐 + 道具后 retarget | — | 庄家逆变器真翻弹；放大镜后按已知弹打 |
| v3d | 校准曲线重量化阈值 | **注入 rng + 先手开关**；客户端按 turnId 回写 revealedShell | 分桶看真实实弹率；noul−liveRatio |
| v3e | 电话私有记忆 | — | 已知未来弹时目标打没打对 ≈ 100% |
| 后话 | 浅层 expectimax | 事实层稳定 | Jev 分布当先验，剩余弹序排列不多 |

固定对手胜率（balanced / aggressive / 随机合法，先手对调）**现在还不能跑**，直到 rng 可注入。

主指标仍建议两张表：固定对手胜率；校准曲线。从日志打的标签：膛内 Brier、已知弹正确率、道具浪费、回退率、相对 oracle 的血量后悔。

---

## 7. 请审核者拍板的问题

代码能算、不必问模型的，标了「代码」；还在权衡的标了「政策」。

1. **（代码）道具后是否只重算目标、还是允许第二跳 Jev？** 放大镜/啤酒/逆变器已做局部重算。第二跳会改回合模型。  
2. **（代码）legalActions 与 itemEffects 已按「可执行集合」对齐。** 以后加庄家道具必须两处一起改。要不要收成单一模块当真源？  
3. **（代码）日志要不要现在就在客户端按 turnId 写 revealedShell？** 不做的话 v3d 永远做不了。  
4. **（政策）合成要不要从字典序改成对每个合法动作算代码期望值、只在算不出来的地方信 Noul？** 这才是 §1 的主张。Q「致死局锯/开枪要不要提前」只是这条的一个特例。  
5. **（政策）已知空包要不要写逆变器组合？** 会少一次续回合，换一次打对手。  
6. **（政策）滑条默认 0.55 是否继续用到有校准曲线？** 改成 0.50 **不等于**信 liveRatio；有 Noul 时 liveBelief 是 Noul。更有价值的观察量是 `noul − liveRatio`。  
7. **（政策）HUD 要不要对玩家隐藏 noul 数字？**  
8. **（政策）电话记忆 vs 多道具连环，哪个更先？**

审核时请直接标：哪几个问题还在复合判断、哪几个字段该改成代码预计算、阈值该先动哪一个。那会比再写一轮空方案准得多。
