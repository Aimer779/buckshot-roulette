# Jev 庄家政策参考（审核用）

> 政策版本：`jev-policy-v3`  
> 钉死模型：TypeSafe `jev-1.13.0` / OpenRouter `typesafe/jev-1.13`  
> 状态：已接入本地 PvE。联机 PvP 不走这条路径。  
> 目的：给审核者一份「现在怎么接、为什么这样接、哪里还可以更好」的材料，而不是再写一轮空方案。

请带着这个问题读：Jev 的权重我们调不了。能变强的只有四样——**代码算出来的事实、问题怎么拆、答案怎么合成、以及用日志量什么**。

---

## 1. Jev 是什么，以及明确不是什么

Jev 是 TypeSafe 的 System One 模型：输入一段 `state` + 一组预先写好的 typed questions，一次前向并行返回校准过的结构化答案。不生成文本，不解释，不发明选项。

三种原语：

| 类型 | 问什么 | 返回 |
|------|--------|------|
| Choice | 从你给的封闭选项里选一个 | `choice` + `probabilities` + `confidence` |
| Score | 在有序量表上打分 | `score`（可落在两档之间） |
| Noul | 是/否 | `noul` ∈ [0, 1] |

官方纪律（接入时必须遵守）：

1. **代码掌控流程。** Jev 只回答窄问题，不规划整回合。
2. **同一请求里的问题彼此独立。** A 的答案不是 B 的输入。要组合，在代码里做。
3. **Jev 不会算数。** 「Math and Numbers」是 1.13 的已知失败模式。计数、比例、比较都不可靠。象棋社区用同一模型测过：只给棋盘，走子不如随机；代码先算好吃子/悬子再塞进 state，才从乱走变成大约 950 Elo。

因此：**有精确答案的东西全部在代码里算，只把事实递给它。** 恶魔轮盘比象棋更适合这句话——公开弹数的期望伤害本来就能算。

Jev 也**不是**：

- 聊天模型 / 可微调权重的分类头
- 自对弈训练器（两边都用 Jev 对打，只是局面生成器）
- 可以放心把 `noul = 0.7` 当成「70% 实弹」的概率计。社区复测倾向于把它当**单调分数**，在自己的数据上再拟合一层校准。

---

## 2. 接入边界

| 项 | 现状 |
|----|------|
| 用途 | 仅本地 PvE 庄家。设置里第四种风格 `Jev · System One` |
| 密钥 | 只在 Node 服务端。`TYPESAFE_API_KEY` 优先，`OPENROUTER_API_KEY` 备用。禁止 `VITE_` |
| 端点 | TypeSafe `POST https://api.typesafe.ai/v1/systemone`；OpenRouter `POST https://openrouter.ai/api/alpha/decisions` |
| 模型钉死 | `jev-1.13.0` / `typesafe/jev-1.13`。不要默认 `jev-latest`（一漂，上周的阈值就作废）。可用 `JEV_MODEL` 覆盖 |
| 公平性 | 请求 **永不发送** `shells[]` 顺序。庄家放大镜写入 `dealerKnownChamber`，玩家 UI 不可见 |
| 回合节奏 | 仍是「最多 1 个道具，然后必须射击」。多道具连环是后续课题 |
| 失败 | 无 key / 超时 / 网络失败 → 回退均衡型，对局不卡死。**合成层不再因「一个大 Choice 置信低」整回合作废** |

---

## 3. 当前流水线（v3）

```
DEALER_TURN
  ├─ 规则层 forced（已知弹 / 全实 / 全空）→ 直接执行，不打 API
  ├─ POST /api/dealer/jev
  │     state.facts（预计算）+ 原子 Noul
  │     服务端再跑一遍 forced（防客户端绕过）
  ├─ 代码合成 compose（healT / infoT / sawT / cuffT / invertT / shootT）
  └─ 失败才 fallback → balancedStrategy
```

### 3.1 规则层（Jev 碰不到）

`inferredKnownChamber` 来源：

- 庄家私有 `knownChamber`（放大镜）
- 或公开计数已确定：`blankCount === 0` → 实弹；`liveCount === 0` → 空包；最后一发同理

闭式解：

| 局面 | 动作 |
|------|------|
| 已知空包 | 对自己开枪（续回合） |
| 已知实弹且有手锯、锯未激活 | 上手锯，然后打玩家 |
| 已知实弹否则 | 打玩家 |

未做、有意留白的组合：已知空包 + 逆变器 + 手锯改打对手。一回合只能用一个道具，这套组合目前不在规则层。

### 3.2 预计算 facts（不要让 Jev 自己除）

`buildJevFacts` 写出并放进 `state.facts`：

```
liveRatio, blankRatio, knownChamber,
lethalIfLive, selfDiesIfLive, extraTurnValue,
infoItemsLeft, healLegal, sawLegal, cuffLegal, invertLegal, magnifierLegal
```

`liveCount` / `blankCount` 仍在 facts 里作核对，但 instructions 明确要求用 `liveRatio`，不要重算。

### 3.3 原子问题（并行 Noul）

不再问「下一步做什么」这一个大 Choice。v1 就是这个结构：开枪和所有道具混在一个 Choice 里，3 实 2 空上手锯时概率摊成 0.38 / 0.37 / 0.25，置信 0.07–0.12，被全局 0.55 砍掉，看起来像「执行力过低」。

v3 按合法性动态带上这些问题（几乎不加延迟）：

| id | 何时问 | 含义 |
|----|--------|------|
| `chamber_likely_live` | 总是 | 当前膛是实弹吗（只看 facts） |
| `opponent_can_kill_next` | 总是 | 对方拿到下一回合，这轮装弹里能否打死自己 |
| `should_heal` | `healLegal` | 这回合要不要抽香烟 |
| `should_spend_info` | 未知弹且有放大镜或啤酒 | 射击前值不值得花信息道具 |
| `should_double` | 手锯合法 | 下一枪前要不要锯 |
| `should_deny_turn` | 手铐合法 | 现在上手铐值不值得 |
| `should_invert` | 未知弹且有逆变器 | 反转是否优于原样打 |

手机仍不进合法动作：庄家电话还没有「未来弹」私有记忆，用了等于浪费。这是已知缺口。

### 3.4 合成顺序（真正可调的参数）

`app/src/lib/dealerStrategies/jev/compose.ts`，阈值在 `jev/policy.ts`：

```
healT   0.55   先回血（浪费代价低）
infoT   0.50   再花放大镜 / 啤酒
cuffT   0.60   若 opponent_can_kill_next > 0.65，手铐提前到锯之前
sawT    0.55   且 chamber_likely_live > 0.55 才锯
invertT 0.70   反转门槛更高
shootT  设置滑条（默认 0.55）→ 打对手所需的膛内实弹判断
```

滑条**不再**是「够不够格听 Jev」。低于 `shootT` 打自己，高于则打对手。已知弹根本不进合成层。

Noul 缺失时，`chamber_likely_live` 回退到代码算的 `liveRatio`，其它 Noul 当 0。这样 API 残缺时仍能开枪，不必整回合扔给均衡型。

### 3.5 日志

服务端每回合打一行 JSON（测试环境静默）：

```json
{
  "tag": "jev-turn",
  "policyVersion": "jev-policy-v3",
  "model": "jev-1.13.0",
  "ruleFired": "jev",
  "action": "use-handsaw",
  "liveBelief": 0.82,
  "nouls": { "chamber_likely_live": 0.82, "should_double": 0.91 },
  "fallback": false,
  "latencyMs": 90
}
```

`ruleFired`：`forced` | `jev` | `fallback`。

**还没有做、但审核时最该要求补上的：** 对局结束后回填真实下一发（`revealedShell`），用来算膛内 Brier / ECE。这个字段不能进请求的 `state`。没有它，阈值只能拍，不能从校准曲线量出来。

---

## 4. 文件地图

| 文件 | 职责 |
|------|------|
| `app/src/lib/dealerStrategies/jev/policy.ts` | 版本号、钉死的 model id、合成阈值 |
| `app/src/lib/dealerStrategies/jev/facts.ts` | 预计算 + 从计数/偷看推断 knownChamber |
| `app/src/lib/dealerStrategies/jev/forced.ts` | 已知弹闭式解 |
| `app/src/lib/dealerStrategies/jev/buildJevRequest.ts` | facts + 原子 Noul |
| `app/src/lib/dealerStrategies/jev/compose.ts` | Noul → 一个合法动作 |
| `app/src/lib/dealerStrategies/jev/answersToDecision.ts` | API 失败回退；成功则 compose |
| `app/server/jev.ts` | 双供应商、forced 再跑一遍、打日志 |
| `app/src/hooks/useDealerTurn.ts` | 客户端 forced 短路，避免浪费请求 |
| `app/src/store/gameStore.ts` | `dealerKnownChamber`、`jevConfidenceMin`（即 shootT） |

密钥模板：`app/.env.example`。pnpm 11 配置：`app/pnpm-workspace.yaml`。

---

## 5. 已知缺口（请优先打这些）

1. **没有事后标签。** 没有 `revealedShell` / `hpDelta` / oracle 对照，校准曲线和「后悔」都算不了。阈值（含滑条默认 0.55）仍是拍的。社区结论：Jev 的 noul 宜当单调分数，在自己的数据上再拟合。
2. **手机对庄家仍无情报。** 放大镜已写入 `dealerKnownChamber`。电话揭示的是未来某一发，需要 `dealerKnownFuture[]`，换弹/弹出后还要平移。没做之前电话不进合法动作。
3. **一回合一个道具。** 原版恶魔轮盘可以连环用药。当前引擎锁死「用药后必须开枪」，所以「反转再锯再打」进不了规则层。
4. **肾上腺素、过期药几乎不进合成。** 没对应 Noul。药在 1 血时已从合法动作剔除。
5. **已知空包的逆变器组合未写死。** 对手 1 血 + 已知空包 + 逆变器，反转后打对手可能优于打自己续回合。
6. **自对弈不能当训练器。** 两边同一套问题，日志只会强化这套政策爱走的路；胜负噪声被下一发弹型主导。自对弈只适合产局面和校准样本。强度对照必须是：同一批种子 × balanced / aggressive / 随机合法，先手对调。
7. **HUD 把 noul 直接显示成百分比。** 方便调试，但容易让人以为 0.70 = 70% 实弹。审核若觉得会误导玩家，应改成条而不标数字，或标明「未校准分数」。

---

## 6. 建议的下一刀（一次只拧一颗螺丝）

对照一定要有「看见下一发的 oracle」，它给的是上限。

| 版本 | 只改一类 | 怎么验收 |
|------|----------|----------|
| v3a（已做） | facts 预计算 | 请求体无 `shells` 顺序；`liveRatio` 由代码算 |
| v3b（已做） | 大 Choice → 原子 Noul | 3 实 2 空上手锯不再因置信 0.12 整回合回退 |
| v3c（部分） | 已知弹硬规则 | 全实/全空/放大镜偷看走 forced；逆变器组合未做 |
| v3d | 校准曲线重量化阈值 | 需要 `revealedShell` 日志。按 noul 分桶看真实实弹率 |
| v3e | 电话私有记忆 | 已知未来弹时目标打没打对，必须接近 100%，否则是规则 bug |
| 后话 | 浅层 expectimax | Jev 的分布当先验，剩余弹序排列不多。先把事实层和硬规则做对，收益通常更大 |

固定种子集（例如 200 个 seed）打 balanced / aggressive / 随机合法，不要只盯 Jev vs Jev 胜率。

主指标建议改成两张表：

1. **固定对手胜率**（同上，先手对调）
2. **校准曲线**：`chamber_likely_live` 按 0.5–0.6、0.6–0.7… 分桶，看「模型说大约 0.7」的桶里真实实弹率

从日志自动打的标签比「谁赢了」值钱：膛内校准（Brier）、已知弹正确率、道具浪费（满血抽烟、已知空包上手锯、最后 1 发还用放大镜）、回退率、相对 oracle 的血量后悔。

---

## 7. 请审核者拍板的问题

1. **合成优先级对不对？** 现在是回血 → 信息 →（对方能杀则手铐）→ 锯 → 手铐 → 反转 → 开枪。要不要把「致死局」的锯/开枪提前到回血之前？
2. **已知空包要不要写逆变器组合？** 会少一次续回合，换一次打对手。
3. **滑条默认 0.55 是否继续用，直到有校准曲线？** 还是先改成 0.50（等于直接信 `liveRatio` 的方向）？
4. **要不要现在就落盘 `revealedShell` 日志**（本地 JSONL，不对玩家展示）？没有它，v3d 做不了。
5. **HUD 要不要对玩家隐藏 noul 数字？** 现在是调试向的。
6. **电话记忆和多道具连环，哪个更先？** 前者补公平信息集，后者改引擎回合模型。

审核时请直接标：哪几个问题还在复合判断、哪几个字段该改成代码预计算、阈值该先动哪一个。那会比再写一轮空方案准得多。
