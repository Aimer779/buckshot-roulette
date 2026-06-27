# 恶魔轮盘（Buckshot Roulette）游戏规则与玩法深度研究报告

---

## 1. 游戏概述和基本概念

### 1.1 什么是恶魔轮盘

《恶魔轮盘》（Buckshot Roulette）是一款由独立开发者 **Mike Klubnika** 开发、**CRITICAL REFLEX** 发行的桌面恐怖策略游戏。游戏于2023年12月28日首次在 itch.io 平台发布，2024年4月4日正式登陆 Steam 平台 [^56^][^66^]。

游戏的核心概念是将经典的"俄罗斯轮盘赌"（Russian Roulette）进行暗黑风格改造——**用一把12号口径泵动式霰弹枪代替传统左轮手枪**，在一个阴森的地下夜总会环境中，玩家与神秘的"庄家"（The Dealer）展开生死对决 [^42^][^56^]。

### 1.2 游戏背景设定

游戏设定在 **1998年8月21日** [^128^]，玩家身处一个昏暗的地下夜总会（underground nightclub）。环境的金属栏杆会随着远处传来的鼓机节拍而颤抖，营造出一种压抑、紧张的氛围 [^56^][^73^]。在开始游戏前，玩家需要签署一份"免责声明"（General Release of Liability），这一设定增强了游戏的黑暗沉浸感 [^128^]。

> "两人进入。一人离开。用你的性命搏一把运气。祝你好运。" —— Steam官方描述 [^56^]

### 1.3 核心设计理念

游戏强调**策略与心理博弈**而非纯粹的运气。虽然表面上看是一个运气游戏，但实际上玩家需要通过概率计算、记忆追踪和道具管理来获得优势 [^27^][^61^]。开发者确认，庄家AI**不会作弊**，它只根据桌面上可见的信息做出决策，与玩家处于完全对等的地位 [^12^]。

---

## 2. 游戏人数和对战模式

### 2.1 游戏人数

《恶魔轮盘》支持以下对战模式：

| 模式 | 人数 | 说明 |
|------|------|------|
| 故事模式（Story Mode） | 1人 vs AI庄家 | 玩家对抗电脑控制的"庄家"（The Dealer）[^66^] |
| 多人模式（Multiplayer） | 2-4人 | 玩家之间互相对抗，最后存活者获胜 [^38^][^83^] |

### 2.2 故事模式

故事模式是游戏的默认模式，玩家与神秘的AI"庄家"进行三回合对决 [^66^]。庄家是一个超自然的存在——它只有一颗巨大的头颅和两只漂浮的手，不需要使用肾上腺素等道具，也不会被除颤器复活，暗示其并非人类 [^86^]。

### 2.3 多人模式

多人模式于 **2024年10月31日** 作为免费更新推出 [^83^]。

- 支持 **2-4名玩家** 同场竞技 [^38^]
- 玩家可以创建房间（host a lobby）、加入私人房间或加入公共房间
- 可以添加AI机器人（bots）填补空位 [^38^]
- 新增多人专属道具：
  - **干扰器（Jammer）**：跳过一名玩家的回合（替代了故事模式中的手铐）[^38^][^81^]
  - **遥控器（Remote）**：反转桌上所有玩家的回合顺序 [^38^][^82^]

### 2.4 双倍或归零模式（Double or Nothing）

完成故事模式后解锁的无尽模式 [^94^]：
- 玩家在洗手间可以找到一瓶药片（pills），服用后进入该模式 [^94^][^96^]
- 核心规则不变，但每轮的生命值和道具数量**随机分配**
- 加入4个专属道具：肾上腺素、一次性手机、过期药品、逆转器 [^94^]
- 击败庄家后，玩家可选择"拿钱走人"或"双倍或归零"继续挑战 [^94^]
- 该模式没有医生复活，失败即从头开始 [^94^]

---

## 3. 一轮游戏的完整流程

### 3.1 游戏整体结构

```
开始游戏
    ↓
签署免责声明（输入玩家名字）
    ↓
第一回合（教学回合，无道具）
    ↓
第二回合（引入道具系统）
    ↓
第三回合（决胜回合，闸刀机制）
    ↓
胜利 → 获得奖金箱 / 失败 → 进入死后世界
```

### 3.2 单回合详细流程

每个回合（Round）的完整流程如下 [^61^][^63^]：

1. **装弹阶段**：庄家当着玩家的面，将一定数量的实弹（红色）和空包弹（黑色）装入霰弹枪
2. **信息展示**：系统明确告知本轮装填的实弹数量和空包弹数量
3. **道具分配**（第二回合起）：随机抽取若干道具给双方
4. **行动阶段**：玩家和庄家轮流行动
5. **射击选择**：每次行动时选择向自己射击或向对方射击
6. **回合结束**：当霰弹枪内所有子弹打完后，重新装弹开始新回合，或一方生命值归零游戏结束

### 3.3 道具使用时机

- 在行动阶段，玩家可以使用任意数量的道具
- 每个道具只能使用一次
- 道具使用后立即生效，然后继续射击选择 [^61^]

---

## 4. 生命值/电量系统

### 4.1 基本概念

游戏中玩家的生命值以"**除颤仪电量**"（Defibrillator Charges）表示 [^66^][^88^]。这是游戏独特的视觉设计——双方各连接一台除颤仪，被实弹击中时会失去一格电量。

### 4.2 各回合初始生命值

| 回合 | 初始生命值（电量） | 道具数量 | 备注 |
|------|------------------|---------|------|
| 第一回合 | 2格 | 无 | 教学回合，纯概率博弈 [^55^][^70^] |
| 第二回合 | 4格 | 每回合2个 | 引入道具系统 [^55^] |
| 第三回合 | 5格 | 每回合4个 | 引入闸刀机制 [^55^] |

### 4.3 生命值扣减

- 被**实弹**击中时，扣除**1格**电量（使用手锯加倍后为2格）[^61^]
- 被**空包弹**击中时，不扣减电量 [^61^]
- 生命值归零时，该方战败 [^63^]

### 4.4 生命值恢复

- **香烟（Cigarette Pack）**：恢复1格电量 [^9^]
- **过期药品（Expired Medicine）**：50%（实际约40%）概率恢复2格电量，否则损失1格 [^9^]
- 满血时无法继续恢复 [^77^]

### 4.5 闸刀机制（Sudden Death / 一击必杀线）

第三回合引入的特殊机制 [^88^][^89^]：
- 当任意一方的电量降至**危险线**（通常为2格或以下）时，触发"闸刀"机制
- 该方除颤仪的电线被切断，对应区域变为黑屏
- **无法使用任何道具恢复电量**（香烟失效）[^11^][^88^]
- 再受到一次实弹攻击即直接死亡
- 这一机制让第三回合后期极度紧张，一次失误就可能全盘皆输 [^89^]

---

## 5. 霰弹枪装填机制

### 5.1 基本装填规则

- 每回合开始时，庄家将随机数量的实弹（红色/Live Shells）和空包弹（黑色/Blank Shells）装入霰弹枪 [^61^][^66^]
- **装填前会明确告知**玩家本轮实弹和空包弹的具体数量 [^61^]
- 装填后子弹的**顺序完全随机**，双方都不知道下一发是什么 [^61^]

### 5.2 各回合弹药配置示例

根据攻略资料，各回合的典型弹药配置如下 [^55^]：

**第一回合（双方2格生命，无道具）：**
- 第一轮回合：1发实弹 + 2发空包弹（共3发）
- 第二轮回合：3发实弹 + 2发空包弹（共5发）

**第二回合（双方4格生命，每回合2个道具）：**
- 第一轮回合：1发实弹 + 1发空包弹（共2发）
- 第二轮回合：2发实弹 + 2发空包弹（共4发）
- 第三轮回合：3发实弹 + 2发空包弹（共5发）
- 第四轮回合：3发实弹 + 3发空包弹（共6发）
- 第五轮回合：5发实弹 + 2发空包弹（共7发）

**第三回合（双方5格生命，每回合4个道具）：**
- 第一轮回合：1发实弹 + 2发空包弹（共3发）
- 第二轮回合：4发实弹 + 4发空包弹（共8发）
- 第三轮回合：3发实弹 + 2发空包弹（共5发）
- 第四轮回合：4发实弹 + 2发空包弹（共6发）

### 5.3 关键策略——数弹

> "数弹是通往胜利的关键。" [^42^]

游戏的核心策略之一就是**追踪已发射的子弹**。虽然初始不知道子弹顺序，但随着射击进行，剩余子弹的构成是可以通过记忆和计算推断的。实弹比例、剩余弹量都会影响最优决策 [^42^][^60^]。

### 5.4 弹药打完后

如果霰弹枪内所有子弹都打完了，但双方生命都未归零，则庄家会重新装填一波新的子弹 [^70^]。

---

## 6. 射击选择

### 6.1 对自己射击（自射）

选择将枪口对准自己开枪时：

| 子弹类型 | 结果 |
|---------|------|
| **空包弹** | 无事发生，玩家**获得额外一次行动机会**（可继续射击或使用道具）[^61^][^63^] |
| **实弹** | 自己失去**1格**电量，回合结束，轮到对手行动 [^61^] |

**自射的策略意义**：
- 当空包弹比例较高时，自射成功后可以获得"额外回合"
- 可以连续行动多次，形成强大的节奏优势 [^60^][^63^]
- 风险与收益并存——需要精确的概率计算

### 6.2 对对手射击

选择将枪口对准对手（庄家或其他玩家）开枪时：

| 子弹类型 | 结果 |
|---------|------|
| **实弹** | 对手失去**1格**电量（未使用手锯时），回合结束，轮到对手行动 [^61^] |
| **空包弹** | 无事发生，回合结束，轮到对手行动 [^61^] |

### 6.3 射击决策的核心博弈

```
对自己射击 + 空包弹 = 额外回合（高收益，但有风险）
对自己射击 + 实弹   = 自己扣血（高风险）
对对手射击 + 实弹   = 对手扣血（稳定收益）
对对手射击 + 空包弹 = 无事发生，回合交换（无收益）
```

玩家的核心决策就是根据**剩余子弹的概率分布**，在"冒险自射求额外回合"和"稳定攻击对手"之间做出选择 [^60^][^63^]。

---

## 7. 游戏阶段/回合结构

### 7.1 三回合总体结构

| 回合 | 生命值 | 道具 | 特殊机制 | 复活机制 |
|------|--------|------|---------|---------|
| 第一回合 | 2格 | 无 | 基础规则 | 可无限复活 |
| 第二回合 | 4格 | 每轮回合2个 | 引入道具 | 可无限复活 |
| 第三回合 | 5格 | 每轮回合4个 | 闸刀机制 | 无（闸刀后一击必杀）|

### 7.2 回合推进流程

**第一回合——教学阶段** [^66^]：
- 无道具，纯粹的概率计算与射击决策
- 帮助新玩家理解核心机制
- 弹药量较少，节奏快速

**第二回合——策略深化** [^66^]：
- 引入道具系统，每轮回合开始时随机获得2个道具
- 双方各有8个道具槽位 [^61^]
- 道具的加入让决策更加复杂，策略性大增
- 失败的玩家会被"医生"（Doctor）复活重新挑战 [^66^]

**第三回合——决胜阶段** [^66^]：
- 每轮回合开始时随机获得4个道具
- 当任意一方电量降至2格或以下时，触发**闸刀机制**
- 闸刀触发后，该方无法再恢复电量
- 失去所有电量即为最终死亡，游戏结束
- 失败的玩家进入"天堂"场景，需要从头开始 [^97^]

### 7.3 单回合内部结构

每个回合（Stage）包含多个"装填-射击"循环：

1. 庄家展示弹药数量 → 装弹
2. 道具分配（如有）
3. 玩家行动：使用道具 → 选择射击目标 → 射击
4. 如果是空包弹自射，回到步骤3继续行动
5. 轮到对手行动，重复步骤3-4
6. 弹药打完 → 返回步骤1重新装弹
7. 直到一方生命归零

### 7.4 单局时长

完整一局游戏（三回合）平均耗时 **15-20分钟** [^25^][^27^][^12^]。

---

## 8. 胜负判定条件

### 8.1 基本胜负条件

- **胜利条件**：将对手的生命值（除颤仪电量）降至零 [^63^][^70^]
- **失败条件**：自己的生命值先被降至零 [^63^]

### 8.2 不同模式的胜负处理

**故事模式**：
- 第一、二回合失败：被医生复活，重新挑战该回合 [^66^]
- 第三回合失败（闸刀后）：进入死亡场景（白色虚空中的黑色大门），显示"YOU ARE DEAD"，必须从第一回合重新开始 [^97^]
- 三回合全部胜利：庄家倒下，玩家获得装满现金的手提箱，驾车离开 [^91^][^97^]

**双倍或归零模式**：
- 胜利后可以选择"拿钱离开"或"双倍或归零"继续挑战
- 失败则失去所有累积奖金，回到洗手间重新开始 [^94^]

**多人模式**：
- 死亡的玩家在本局游戏中无法复活，只能观战 [^38^]
- 最后存活的玩家获胜

### 8.3 胜利收益

成功击败庄家后，玩家将获得 **70,000美元** 的奖金 [^91^]，游戏界面会显示获得金额。在双倍或归零模式中，奖金可以不断翻倍累积 [^76^]。

---

## 9. 道具系统详解

### 9.1 基础模式道具（第一回合后出现）

| 道具名称 | 图标/描述 | 效果 | 评级 |
|---------|----------|------|------|
| **放大镜**（Magnifying Glass） | 查看枪膛内当前子弹 | 揭示当前待发射的子弹是实弹还是空包弹 | T0 [^10^] |
| **香烟**（Cigarette Pack） | 恢复1点生命 | 恢复1格电量，满血时无法使用 | T0 [^10^] |
| **手铐**（Handcuffs） | 跳过对方回合 | 使对方下一回合无法行动 | T0 [^10^] |
| **手锯**（Hand Saw / Switchblade） | 下一发伤害翻倍 | 使下一发实弹造成**2点**伤害 | T0 [^9^][^10^] |
| **啤酒**（Beer） | 弹出当前子弹 | 将当前枪膛内的子弹退出（不发射） | T1 [^10^] |

### 9.2 双倍或归零/多人模式专属道具

| 道具名称 | 效果 | 评级 |
|---------|------|------|
| **肾上腺素**（Adrenaline） | 窃取对手一个道具并立即使用（约5秒时限） | T0 [^9^][^10^] |
| **逆转器**（Inverter） | 将当前子弹的类型反转（实弹变空包，空包变实弹） | T0.5 [^10^] |
| **过期药品**（Expired Medicine） | 约40%概率恢复2格电量，否则损失1格 | T2 [^9^][^10^] |
| **一次性手机**（Burner Phone） | 一个神秘声音告知你枪中某颗子弹的类型和位置 | T1 [^9^][^10^] |
| **干扰器**（Jammer） | 跳过一名玩家的回合（多人模式替代手铐） | - [^38^] |
| **遥控器**（Remote） | 反转整个桌上所有玩家的回合顺序 | - [^82^] |

### 9.3 道具持有上限

每个玩家最多同时拥有 **8个** 道具。如果已有8个道具，新回合不会再获得额外道具 [^12^]。

### 9.4 经典道具组合

1. **放大镜 + 手锯**：先用放大镜确认下一发是实弹，再用手锯加倍，可造成2点伤害秒杀低血量对手 [^60^]
2. **手铐 + 手锯 + 确认实弹**：限制对手行动 + 双倍伤害，连续两回合爆发
3. **一次性手机 + 啤酒**：预知危险子弹后用啤酒弹走
4. **肾上腺素 + 窃取香烟**：抢走对手的恢复道具削弱其续航能力 [^77^]

---

## 10. 游戏的视觉风格和氛围特点

### 10.1 美术风格

- **复古像素风**：游戏采用类似《Inscryption》的复古像素美术风格（开发者承认受到《Inscryption》创作者 Daniel Mullins 的影响）[^72^][^146^]
- **桌面视角**：采用第一人称桌面视角，玩家始终面对对手和桌上的霰弹枪，无法逃避紧张氛围 [^73^]
- **暗色调配色**：整体画面以黑色、深灰色为主，实弹的红色成为画面中最醒目的颜色

### 10.2 环境氛围

- **地下夜总会设定**：金属栏杆、昏暗灯光、远处的鼓机节拍构成独特的环境音景 [^56^][^73^]
- **沉浸式音效设计**：霰弹枪的泵动声、子弹上膛声、扳机扣动声、空包弹的咔嗒声都经过精心设计，每一声都直击紧张神经 [^73^][^74^]
- **极简UI设计**：游戏采用"diegetic"（世界内）界面系统，所有信息都通过游戏世界中的物体呈现（如除颤仪显示血量），而非传统UI菜单 [^12^]

### 10.3 音乐原声带

游戏原声带由两部分组成 [^127^]：

**第一卷（Mike Klubnika创作）**：
1. Blank Shell（主菜单）
2. General Release（第一回合）
3. Before Every Load（第二回合）
4. Socket Calibration（第三回合 - 闸刀前）
5. Monochrome LCD（闸刀触发后）
6. 70K（结算画面）
7. You Are An Angel（死亡场景）

**第二卷（Alex Peipman创作，多人模式更新加入）**：
8. Desolate（多人模式大厅）
9. Surrounded（开场动画/第一回合）
10. Twice or it's Luck（第二回合）
11. Overdose Casino（第三回合）
12. Koni（结算画面）

原声带已发行黑胶唱片和磁带版本 [^129^][^134^]，以其工业电子风格和紧张氛围著称。

### 10.4 庄家（The Dealer）角色设计

庄家是游戏的灵魂角色 [^86^][^87^]：
- **外形**：只有一颗巨大的头和两只漂浮的手，没有身体
- **表情**：标志性的咧嘴笑，被击中时会变为痛苦或愤怒的表情
- **性格**：礼貌、有魅力但冷酷无情，严格遵守游戏规则
- **超自然特性**：不需要肾上腺素，不会被除颤器复活
- **传说**：游戏中暗示庄家曾经击败了上帝，接管了死后世界 [^87^][^128^]

---

## 11. 关键数据汇总

| 项目 | 数据 |
|------|------|
| 开发商 | Mike Klubnika |
| 发行商 | CRITICAL REFLEX |
| 首发日期 | 2023年12月28日（itch.io）/ 2024年4月4日（Steam）|
| 平台 | PC（Steam/itch.io）、Xbox |
| Steam售价 | $2.99 [^83^] |
| 单局时长 | 15-20分钟 |
| 玩家数量 | 1-4人 |
| 总道具数 | 9个基础道具 + 多人专属道具 |
| 第一回合生命 | 2格 |
| 第二回合生命 | 4格 |
| 第三回合生命 | 5格 |
| 手锯加倍伤害 | 2点 |
| 道具持有上限 | 8个 |
| 原声曲目数 | 12首（两卷）|

---

## 引用来源

[^9^]: https://holdtoreset.com/buckshot-roulette-items-and-what-they-do/ - Buckshot Roulette Items and What They Do
[^10^]: https://tieba.baidu.com/p/9065836755 - 全道具一览【恶魔轮盘吧】_百度贴吧
[^11^]: https://m.ali213.net/news/gl2602/1748505.html - 恶魔轮盘道具效果大全-恶魔轮盘道具效果汇总_游侠手游
[^12^]: https://gamesfree.io/game/buckshot-roulette/ - Buckshot Roulette Online - Features
[^25^]: https://www.casino.org/blog/how-to-play-buckshot-roulette-rules-items-strategy/ - How to Play Buckshot Roulette FAQ
[^27^]: https://elcasino.com/2026/02/22/how-to-play-buckshot-roulette/ - How to Play Buckshot Roulette - Key Takeaways
[^38^]: https://buckshot-roulette.fandom.com/wiki/Multiplayer - Buckshot Roulette Wiki - Multiplayer
[^42^]: https://amig.25-ph.com/buckshot-roulette-game-rules-777-slots/ - Buckshot Roulette Game Rules
[^55^]: https://shouyou.3dmgame.com/gl/489375.html - buckshotroulette怎么玩-buckshotroulette玩法攻略_3DM手游
[^56^]: https://www.3dmgame.com/news/202404/3892128.html - 独立佳作《恶魔轮盘》现已登录Steam 限时首发特惠！_3DM单机
[^60^]: https://www.diablofans.com.cn/wz/254408.html - 恶魔轮盘游戏规则详解 恶魔轮盘基础玩法与胜负判定全解析
[^61^]: https://www.233leyuan.com/post-detail/2017943861869472460 - buckshot roulette 《恶魔轮盘赌 Buckshot Roulette 》规则介绍
[^63^]: https://wap.pp.cn/news/968247.html - 恶魔轮盘游戏规则详解 恶魔轮盘基础玩法与胜负判定机制_PP助手
[^64^]: https://wap.pp.cn/news/967163.html - 恶魔轮盘游戏规则盘点 恶魔轮盘游戏规则是什么_PP助手
[^66^]: https://buckshot-roulette.fandom.com/wiki/Buckshot_Roulette - Buckshot Roulette Wiki - Gameplay
[^70^]: https://all-about-gaming.fandom.com/wiki/Buckshot_Roulette - Buckshot Roulette - All About Gaming Wiki
[^72^]: https://www.gamereactor.eu/buckshot-roulette-1379503/ - Buckshot Roulette Review
[^73^]: https://games.gg/buckshot-roulette/ - Buckshot Roulette - Overview and Atmosphere
[^74^]: https://storytellergame.io/buckshot-roulette-multiplayer/ - Buckshot Roulette Multiplayer - Thrilling Gameplay
[^77^]: https://kosguides.com/8661-buckshot-roulette-all-items-guide/ - Buckshot Roulette: All Items Guide
[^80^]: https://thebigbois.com/action/buckshot-roulettes-new-multiplayer-mode-brings-terror-to-the-table-on-october-31/ - Multiplayer Mode Release Article
[^81^]: https://steamdeckhq.com/news/buckshot-roulettes-multiplayer-mode-is-out-now/ - Multiplayer Mode Is Out Now
[^82^]: https://www.rockpapershotgun.com/buckshot-roulette-now-has-a-4-person-multiplayer-mode-which-im-sure-you-will-survive - Rock Paper Shotgun Multiplayer Review
[^83^]: https://gamingshogun.com/2024/10/31/buckshot-roulette-multiplayer-update-out-now/ - Buckshot Roulette Multiplayer Update Out Now
[^86^]: https://buckshot-roulette.fandom.com/wiki/Dealer - Buckshot Roulette Wiki - Dealer
[^87^]: https://inconsistently-heinous.fandom.com/wiki/The_Dealer_(Buckshot_Roulette) - The Dealer (Buckshot Roulette) Character Analysis
[^88^]: https://baike.baidu.com/item/恶魔轮盘/64275291 - 恶魔轮盘_百度百科
[^89^]: https://m.wandoujia.com/strategy/9247298077091127275.html - 恶魔轮盘最新版下载地址_豌豆荚
[^91^]: https://caibotlist.com/character/dealer/L2IDjokC94TB71N37AfPtGR8ZqPN4MeyugJz321q3_g - Dealer [Buckshot Roulette]
[^94^]: https://www.sportskeeda.com/esports/unlock-play-double-nothing-buckshot-roulette - How to unlock and play Double or Nothing
[^96^]: https://www.pcinvasion.com/how-to-unlock-and-play-double-or-nothing-in-buckshot-roulette/ - How to unlock and play Double or Nothing
[^97^]: https://www.sportskeeda.com/esports/buckshot-roulette-endings - Buckshot Roulette endings explained
[^127^]: https://buckshot-roulette.fandom.com/wiki/Soundtrack - Buckshot Roulette Wiki - Soundtrack
[^128^]: https://buckshot-roulette.fandom.com/wiki/General_Release_of_Liability - General Release of Liability
[^129^]: https://materia.store/products/buckshot-roulette-original-soundtrack-mike-klubnika-casette-tape - Buckshot Roulette Original Soundtrack Cassette
[^134^]: https://blackscreenrecords.com/products/buckshot-roulette - Mike Klubnika • Buckshot Roulette • Original Soundtrack Vinyl
[^146^]: https://www.notebookcheck.net/Behind-Buckshot-Roulette-Mike-Klubnika-shares-the-creative-force-behind-his-macabre-hit-title.914625.0.html - Behind Buckshot Roulette: Mike Klubnika Interview

---

*文档生成时间：基于截至2025年的游戏信息*
*游戏版本：Steam正式版（含多人模式更新）*
