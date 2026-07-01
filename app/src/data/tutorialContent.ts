import type { ItemType } from '@/store/gameStore';

// ─── Types ───────────────────────────────────────────────

export interface TutorialItemDetail {
  type: ItemType;
  name: string;
  description: string;
  image: string;
  rating: number;
  category: string;
  combo?: string;
  tip?: string;
}

// ─── Item Data ───────────────────────────────────────────

export const TUTORIAL_ITEM_DETAILS: TutorialItemDetail[] = [
  {
    type: 'magnifier',
    name: '放大镜',
    description: '查看枪膛中当前的子弹类型。是实弹还是空包弹，一目了然。',
    image: '/item-magnifier.png',
    rating: 5,
    category: '信息获取',
    combo: '放大镜 + 手锯 = 确认实弹后造成双倍伤害',
    tip: '最优先使用的道具，信息量最大',
  },
  {
    type: 'handcuffs',
    name: '手铐',
    description: '锁住对手，跳过对方的下一个回合。获得额外行动机会。',
    image: '/item-handcuffs.png',
    rating: 4,
    category: '控制',
    combo: '手铐 + 实弹 = 连续两个回合输出伤害',
    tip: '配合已知实弹使用，收益最高',
  },
  {
    type: 'cigarette',
    name: '香烟',
    description: '点燃一支香烟，恢复 1 点生命值。简单的回血道具。',
    image: '/item-cigarette.png',
    rating: 3,
    category: '恢复',
    tip: '生命值较低时使用，但不要贪心',
  },
  {
    type: 'beer',
    name: '啤酒',
    description: '喝掉啤酒并将当前枪膛内的子弹弹出。无需承受子弹效果。',
    image: '/item-beer.png',
    rating: 4,
    category: '子弹操控',
    combo: '啤酒 + 已知空包弹 = 节省回合',
    tip: '用于跳过已知的危险子弹',
  },
  {
    type: 'handsaw',
    name: '手锯',
    description: '锯短枪管，下一发射击的伤害翻倍（2 点）。',
    image: '/item-handsaw.png',
    rating: 4,
    category: '伤害增强',
    combo: '手锯 + 放大镜 = 确认实弹后双倍伤害',
    tip: '确认下一发是实弹后再使用',
  },
  {
    type: 'adrenaline',
    name: '肾上腺素',
    description: '注射肾上腺素，偷取对手的一个道具并立即使用。',
    image: '/item-adrenaline.png',
    rating: 5,
    category: '特殊',
    combo: '肾上腺素 + 对方满道具 = 最大化收益',
    tip: '对方道具多时最划算',
  },
  {
    type: 'medicine',
    name: '过期药品',
    description: '冒险服用过期药品。50% 概率恢复 2 点生命，50% 概率失去 1 点生命。',
    image: '/item-medicine.png',
    rating: 3,
    category: '恢复/赌博',
    tip: '绝境时赌一把，满血时别冒险',
  },
  {
    type: 'inverter',
    name: '逆变器',
    description: '翻转当前枪膛内子弹的类型。实弹变空包弹，空包弹变实弹。',
    image: '/item-inverter.png',
    rating: 4,
    category: '子弹操控',
    combo: '逆变器 + 已知空包弹 = 获得免费回合',
    tip: '将空包弹翻转为实弹后射击对手',
  },
  {
    type: 'phone',
    name: '一次性手机',
    description: '拨打神秘号码，随机获知枪膛内某一发子弹的信息。',
    image: '/item-phone.png',
    rating: 4,
    category: '信息获取',
    tip: '信息随机，但可能扭转战局',
  },
];

// ─── Round 4 page: classic combos & survival tips ────────

export const TUTORIAL_COMBOS = [
  '放大镜 + 手锯 = 确认实弹后造成 2 点伤害',
  '手铐 + 控制 + 伤害 = 连续行动压制对手',
];

export const TUTORIAL_SURVIVAL_TIPS = [
  '时刻追踪剩余实弹和空包弹数量',
  '优先使用放大镜获取信息，再做决策',
  '合理管理道具，不要等到临死才用',
  '对自己开枪有风险，但空包弹意味着免费回合',
  '第三回合的闸刀机制会彻底改变策略',
];
