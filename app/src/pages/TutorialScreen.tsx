import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ArrowLeft, Star, AlertTriangle, X } from 'lucide-react';
import { playSFX } from '@/lib/sound';
import { ITEM_INFO } from '@/store/gameStore';
import type { ItemType } from '@/store/gameStore';
import { useGameStore } from '@/store/gameStore';

// ─── Types ───────────────────────────────────────────────

interface ItemDetail {
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

const ITEM_DETAILS: ItemDetail[] = [
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

// ─── Animation Variants ─────────────────────────────────

const easeSharp = [0.4, 0, 0.2, 1] as [number, number, number, number];
const easeBounce = [0.68, -0.55, 0.265, 1.55] as [number, number, number, number];
const easeSmooth = [0.25, 0.46, 0.45, 0.94] as [number, number, number, number];

const pageVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 40 : -40,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -40 : 40,
    opacity: 0,
  }),
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.5, ease: easeSmooth },
  },
};

const navBarVariants = {
  hidden: { y: -20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { delay: 0.2, duration: 0.3, ease: easeSharp },
  },
};

const manualVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { delay: 0.3, duration: 0.4, ease: easeSmooth },
  },
};

const contentVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { delay: 0.4, duration: 0.3, ease: easeSmooth },
  },
};

const paginationVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { delay: 0.5, duration: 0.3, ease: easeSmooth },
  },
};

const bottomVariants = {
  hidden: { y: 10, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { delay: 0.6, duration: 0.3, ease: easeSharp },
  },
};

const itemCardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.1 + i * 0.06,
      duration: 0.35,
      ease: easeSmooth,
    },
  }),
};

// ─── Component ──────────────────────────────────────────

export default function TutorialScreen() {
  const navigate = useNavigate();
  const setShowTutorial = useGameStore((s) => s.setShowTutorial);

  const [currentPage, setCurrentPage] = useState(0);
  const [direction, setDirection] = useState(0);
  const [selectedItem, setSelectedItem] = useState<ItemDetail | null>(null);
  const totalPages = 4;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedItem) {
        if (e.key === 'Escape') {
          setSelectedItem(null);
        }
        return;
      }

      if (e.key === 'ArrowLeft') {
        goToPage(currentPage - 1);
      } else if (e.key === 'ArrowRight') {
        goToPage(currentPage + 1);
      } else if (e.key === 'Escape') {
        handleBack();
      } else if (e.key === 'Enter' && currentPage === totalPages - 1) {
        handleStart();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, selectedItem]);

  const goToPage = useCallback(
    (page: number) => {
      if (page < 0 || page >= totalPages) return;
      playSFX('shell-eject', 0.3);
      setDirection(page > currentPage ? 1 : -1);
      setCurrentPage(page);
    },
    [currentPage]
  );

  const handleBack = useCallback(() => {
    playSFX('shotgun-click', 0.3);
    navigate('/');
  }, [navigate]);

  const handleStart = useCallback(() => {
    playSFX('shotgun-pump');
    setShowTutorial(false);
    navigate('/play');
  }, [navigate, setShowTutorial]);

  const handleSkip = useCallback(() => {
    playSFX('shotgun-click', 0.3);
    setShowTutorial(false);
    navigate('/play');
  }, [navigate, setShowTutorial]);

  const pageTitles = [
    '欢迎来到地下夜总会',
    '核心规则',
    '道具图鉴',
    '回合演进',
  ];

  // ─── Page 1: Game Overview ──────────────────────────

  const renderPage1 = () => (
    <div className="flex flex-col gap-6 h-full">
      <div className="text-center mb-2">
        <h2
          className="font-chinese text-2xl sm:text-[22px] font-bold mb-2"
          style={{ color: 'var(--accent-red)' }}
        >
          {pageTitles[0]}
        </h2>
        <div className="mx-auto" style={{ width: '120px', height: '2px', backgroundColor: 'var(--accent-red)', boxShadow: '0 0 8px var(--accent-red)' }} />
      </div>

      <p
        className="font-chinese text-base leading-relaxed"
        style={{ color: 'var(--text-primary)' }}
      >
        1998年，你坐在一家地下夜总会的金属桌前。对面坐着神秘的"庄家"——一个与你进行生死对决的存在。
      </p>

      {/* Tagline highlight box */}
      <div
        className="rounded-lg p-6 border-l-4"
        style={{
          backgroundColor: 'rgba(220, 38, 38, 0.1)',
          borderColor: 'var(--accent-red)',
          borderWidth: '2px',
          borderLeftWidth: '4px',
        }}
      >
        <p
          className="font-chinese text-lg font-medium text-center leading-relaxed"
          style={{ color: 'var(--text-primary)' }}
        >
          两人进入。一人离开。
        </p>
        <p
          className="font-chinese text-base text-center mt-3 leading-relaxed"
          style={{ color: 'var(--text-primary)' }}
        >
          一把霰弹枪。实弹与空包弹。你或他。活到最后的，才能离开这张桌子。
        </p>
      </div>

      <p
        className="font-chinese text-base leading-relaxed"
        style={{ color: 'var(--text-secondary)' }}
      >
        游戏分为三个回合，难度逐步升级。每个回合中，你们轮流选择对自己或对庄家扣动扳机。
      </p>

      <p
        className="font-chinese text-base leading-relaxed mt-auto"
        style={{ color: 'var(--text-dim)' }}
      >
        祝你好运。
      </p>
    </div>
  );

  // ─── Page 2: Core Rules ─────────────────────────────

  const renderPage2 = () => (
    <div className="flex flex-col gap-5 h-full overflow-y-auto">
      <div className="text-center mb-1">
        <h2
          className="font-chinese text-2xl sm:text-[22px] font-bold mb-2"
          style={{ color: 'var(--accent-red)' }}
        >
          {pageTitles[1]}
        </h2>
        <div className="mx-auto" style={{ width: '120px', height: '2px', backgroundColor: 'var(--accent-red)', boxShadow: '0 0 8px var(--accent-red)' }} />
      </div>

      {/* Round flow */}
      <div>
        <h3
          className="font-chinese text-lg font-bold mb-3"
          style={{ color: 'var(--text-primary)' }}
        >
          回合流程
        </h3>
        <div
          className="flex flex-wrap items-center gap-2 font-chinese text-sm"
          style={{ color: 'var(--text-secondary)' }}
        >
          <span className="px-3 py-1 rounded-md" style={{ backgroundColor: 'var(--bg-elevated)' }}>① 装弹</span>
          <ChevronRight className="w-4 h-4" style={{ color: 'var(--accent-red)' }} />
          <span className="px-3 py-1 rounded-md" style={{ backgroundColor: 'var(--bg-elevated)' }}>② 玩家回合</span>
          <ChevronRight className="w-4 h-4" style={{ color: 'var(--accent-red)' }} />
          <span className="px-3 py-1 rounded-md" style={{ backgroundColor: 'var(--bg-elevated)' }}>③ 庄家回合</span>
          <ChevronRight className="w-4 h-4" style={{ color: 'var(--accent-red)' }} />
          <span className="px-3 py-1 rounded-md" style={{ backgroundColor: 'var(--bg-elevated)' }}>重复</span>
        </div>
      </div>

      {/* Shell types */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div
          className="flex-1 rounded-lg p-4 border"
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-elevated)' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-5 h-5 rounded-full"
              style={{ backgroundColor: 'var(--accent-red)', boxShadow: '0 0 8px var(--accent-red)' }}
            />
            <span className="font-chinese text-base font-bold" style={{ color: 'var(--accent-red)' }}>
              实弹
            </span>
          </div>
          <p className="font-chinese text-sm" style={{ color: 'var(--text-secondary)' }}>
            造成伤害，回合结束
          </p>
        </div>
        <div
          className="flex-1 rounded-lg p-4 border"
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-elevated)' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-5 h-5 rounded-full"
              style={{ backgroundColor: 'var(--accent-blue-dim)', boxShadow: '0 0 8px var(--accent-blue)' }}
            />
            <span className="font-chinese text-base font-bold" style={{ color: 'var(--accent-blue)' }}>
              空包弹
            </span>
          </div>
          <p className="font-chinese text-sm" style={{ color: 'var(--text-secondary)' }}>
            无伤害，对自己开枪可额外回合
          </p>
        </div>
      </div>

      {/* Shooting choices */}
      <div>
        <h3
          className="font-chinese text-lg font-bold mb-3"
          style={{ color: 'var(--text-primary)' }}
        >
          射击选择
        </h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <div
            className="flex-1 rounded-lg p-4 border"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-elevated)' }}
          >
            <h4 className="font-chinese text-base font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              对自己射击
            </h4>
            <p className="font-chinese text-sm mb-1" style={{ color: 'var(--accent-blue)' }}>
              空包弹 → 额外回合（高收益）
            </p>
            <p className="font-chinese text-sm" style={{ color: 'var(--accent-red)' }}>
              实弹 → 自己受伤，回合结束
            </p>
          </div>
          <div
            className="flex-1 rounded-lg p-4 border"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-elevated)' }}
          >
            <h4 className="font-chinese text-base font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              对庄家射击
            </h4>
            <p className="font-chinese text-sm mb-1" style={{ color: 'var(--accent-red)' }}>
              实弹 → 庄家受伤，回合结束
            </p>
            <p className="font-chinese text-sm" style={{ color: 'var(--text-dim)' }}>
              空包弹 → 无事发生，回合结束
            </p>
          </div>
        </div>
      </div>

      <p
        className="font-chinese text-sm"
        style={{ color: 'var(--text-dim)' }}
      >
        每回合开始时，会告知实弹和空包弹数量，但顺序完全随机。
      </p>
    </div>
  );

  // ─── Page 3: Item Guide ─────────────────────────────

  const renderPage3 = () => (
    <div className="flex flex-col gap-5 h-full overflow-y-auto">
      <div className="text-center mb-1">
        <h2
          className="font-chinese text-2xl sm:text-[22px] font-bold mb-2"
          style={{ color: 'var(--accent-red)' }}
        >
          {pageTitles[2]}
        </h2>
        <div className="mx-auto" style={{ width: '120px', height: '2px', backgroundColor: 'var(--accent-red)', boxShadow: '0 0 8px var(--accent-red)' }} />
      </div>

      {/* Item grid */}
      <div className="grid grid-cols-3 gap-3">
        {ITEM_DETAILS.map((item, i) => (
          <motion.button
            key={item.type}
            custom={i}
            variants={itemCardVariants}
            initial="hidden"
            animate="visible"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              playSFX('item-use', 0.3);
              setSelectedItem(item);
            }}
            className="flex flex-col items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--bg-elevated)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-gold)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 0 16px rgba(212, 165, 32, 0.2)';
              (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(212, 165, 32, 0.05)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--bg-elevated)';
              (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-surface)';
            }}
          >
            <img
              src={item.image}
              alt={item.name}
              className="w-12 h-12 sm:w-14 sm:h-14 object-contain pointer-events-none"
              draggable={false}
            />
            <span
              className="font-chinese text-sm font-bold text-center"
              style={{ color: 'var(--text-primary)' }}
            >
              {item.name}
            </span>
            <span
              className="font-chinese text-xs text-center leading-tight line-clamp-2"
              style={{ color: 'var(--text-secondary)' }}
            >
              {ITEM_INFO[item.type]?.description || item.description}
            </span>
          </motion.button>
        ))}
      </div>

      <p
        className="font-chinese text-xs text-center"
        style={{ color: 'var(--text-dim)' }}
      >
        点击道具查看详细说明。道具使用后立即消失，每回合使用数量不限。最多持有8个道具。
      </p>
    </div>
  );

  // ─── Page 4: Round Progression ──────────────────────

  const renderPage4 = () => (
    <div className="flex flex-col gap-5 h-full overflow-y-auto">
      <div className="text-center mb-1">
        <h2
          className="font-chinese text-2xl sm:text-[22px] font-bold mb-2"
          style={{ color: 'var(--accent-red)' }}
        >
          {pageTitles[3]}
        </h2>
        <div className="mx-auto" style={{ width: '120px', height: '2px', backgroundColor: 'var(--accent-red)', boxShadow: '0 0 8px var(--accent-red)' }} />
      </div>

      {/* Round cards */}
      <div className="flex flex-col gap-3">
        {/* Round 1 */}
        <div
          className="rounded-lg p-4 border-l-4"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--accent-blue)',
            borderLeftWidth: '4px',
            borderWidth: '1px',
            borderLeftColor: 'var(--accent-blue)',
          }}
        >
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h3 className="font-chinese text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              第一回合
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-chinese" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
              2点生命
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-chinese" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
              无道具
            </span>
          </div>
          <p className="font-chinese text-sm" style={{ color: 'var(--text-secondary)' }}>
            最简单的配置，霰弹枪装填 1-2 发实弹和 2-3 发空包弹。没有道具，纯粹的博弈。
          </p>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <ChevronRight className="w-5 h-5 rotate-90" style={{ color: 'var(--text-dim)' }} />
        </div>

        {/* Round 2 */}
        <div
          className="rounded-lg p-4 border-l-4"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--accent-amber)',
            borderWidth: '1px',
            borderLeftWidth: '4px',
            borderLeftColor: 'var(--accent-amber)',
          }}
        >
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h3 className="font-chinese text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              第二回合
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-chinese" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
              4点生命
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-chinese" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
              每轮2个道具
            </span>
          </div>
          <p className="font-chinese text-sm" style={{ color: 'var(--text-secondary)' }}>
            道具系统解锁！生命值增加，装填更多子弹。策略深度大幅提升。
          </p>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <ChevronRight className="w-5 h-5 rotate-90" style={{ color: 'var(--text-dim)' }} />
        </div>

        {/* Round 3 */}
        <div
          className="rounded-lg p-4 border-l-4"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--accent-red)',
            borderWidth: '1px',
            borderLeftWidth: '4px',
            borderLeftColor: 'var(--accent-red)',
          }}
        >
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h3 className="font-chinese text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              第三回合
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-chinese" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
              5点生命
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-chinese" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
              每轮4个道具
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-chinese" style={{ backgroundColor: 'rgba(220, 38, 38, 0.2)', color: 'var(--accent-red)' }}>
              闸刀
            </span>
          </div>
          <p className="font-chinese text-sm" style={{ color: 'var(--text-secondary)' }}>
            最终对决！引入致命闸刀机制：生命降至2点以下时，除颤仪被切断。无法恢复生命，下一次实弹命中直接死亡。
          </p>
        </div>
      </div>

      {/* Guillotine warning */}
      <div
        className="flex items-start gap-3 rounded-lg p-4 border"
        style={{
          backgroundColor: 'rgba(220, 38, 38, 0.1)',
          borderColor: 'var(--accent-red)',
          borderWidth: '2px',
        }}
      >
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--accent-red)' }} />
        <div>
          <p className="font-chinese text-sm font-bold mb-1" style={{ color: 'var(--accent-red)' }}>
            闸刀警告
          </p>
          <p className="font-chinese text-sm" style={{ color: 'var(--text-primary)' }}>
            生命 ≤ 2 时，恢复类道具失效。请谨慎管理生命值。
          </p>
        </div>
      </div>

      {/* Classic combos */}
      <div>
        <h3
          className="font-chinese text-base font-bold mb-3"
          style={{ color: 'var(--accent-gold)' }}
        >
          经典 Combo
        </h3>
        <div className="flex flex-col gap-2">
          <div
            className="rounded-md p-3 border"
            style={{ backgroundColor: 'rgba(212, 165, 32, 0.05)', borderColor: 'rgba(212, 165, 32, 0.2)' }}
          >
            <p className="font-chinese text-sm" style={{ color: 'var(--accent-gold)' }}>
              放大镜 + 手锯 = 确认实弹后造成 2 点伤害
            </p>
          </div>
          <div
            className="rounded-md p-3 border"
            style={{ backgroundColor: 'rgba(212, 165, 32, 0.05)', borderColor: 'rgba(212, 165, 32, 0.2)' }}
          >
            <p className="font-chinese text-sm" style={{ color: 'var(--accent-gold)' }}>
              手铐 + 控制 + 伤害 = 连续行动压制对手
            </p>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div>
        <h3
          className="font-chinese text-base font-bold mb-3"
          style={{ color: 'var(--text-primary)' }}
        >
          生存提示
        </h3>
        <ul className="flex flex-col gap-1.5">
          {[
            '时刻追踪剩余实弹和空包弹数量',
            '优先使用放大镜获取信息，再做决策',
            '合理管理道具，不要等到临死才用',
            '对自己开枪有风险，但空包弹意味着免费回合',
            '第三回合的闸刀机制会彻底改变策略',
          ].map((tip, i) => (
            <li
              key={i}
              className="font-chinese text-sm flex items-start gap-2"
              style={{ color: 'var(--text-secondary)' }}
            >
              <span style={{ color: 'var(--accent-red)' }}>•</span>
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 0: return renderPage1();
      case 1: return renderPage2();
      case 2: return renderPage3();
      case 3: return renderPage4();
      default: return null;
    }
  };

  return (
    <motion.div
      className="relative min-h-[100dvh] w-full overflow-hidden"
      style={{ backgroundColor: 'var(--bg-void)' }}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Background image */}
      <div
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: 'url(/bg-tutorial.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.4,
        }}
      />
      {/* Dark overlay */}
      <div
        className="fixed inset-0 z-[1]"
        style={{ backgroundColor: 'rgba(10, 10, 15, 0.6)' }}
      />

      {/* Content */}
      <div className="relative z-10 min-h-[100dvh] flex flex-col items-center px-4 py-6">
        {/* Top Nav Bar */}
        <motion.div
          className="w-full flex items-center justify-between mb-4"
          style={{ maxWidth: '900px', height: '64px' }}
          variants={navBarVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Back button */}
          <motion.button
            onClick={handleBack}
            className="flex items-center gap-2 px-4 h-10 rounded-lg transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            whileHover={{ x: -2, color: 'var(--text-primary)' }}
            whileTap={{ scale: 0.95 }}
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-chinese text-base">返回</span>
          </motion.button>

          {/* Title */}
          <h1
            className="absolute left-1/2 -translate-x-1/2 font-chinese text-xl sm:text-2xl font-bold pointer-events-none"
            style={{ color: 'var(--text-primary)' }}
          >
            游戏说明
          </h1>

          {/* Skip button */}
          <motion.button
            onClick={handleSkip}
            className="font-chinese text-sm transition-colors"
            style={{ color: 'var(--text-dim)', textDecoration: 'underline' }}
            whileHover={{ color: 'var(--text-secondary)' }}
          >
            跳过教程
          </motion.button>
        </motion.div>

        {/* Manual Container */}
        <motion.div
          className="w-full rounded-xl border overflow-hidden flex flex-col"
          style={{
            maxWidth: '900px',
            width: 'min(90vw, 800px)',
            height: 'calc(100dvh - 200px)',
            backgroundColor: 'rgba(20, 20, 27, 0.9)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderColor: 'rgba(255, 255, 255, 0.08)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
          }}
          variants={manualVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Left red neon edge decoration */}
          <div
            className="absolute left-0 top-0 bottom-0 w-[3px]"
            style={{
              backgroundColor: 'var(--accent-red)',
              boxShadow: '0 0 12px var(--accent-red)',
              zIndex: 5,
            }}
          />

          {/* Content area */}
          <motion.div
            className="flex-1 p-6 sm:p-8 overflow-y-auto"
            variants={contentVariants}
            initial="hidden"
            animate="visible"
          >
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentPage}
                custom={direction}
                variants={pageVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: 'tween', duration: 0.3, ease: easeSharp },
                  opacity: { duration: 0.2 },
                }}
                className="h-full"
              >
                {renderCurrentPage()}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </motion.div>

        {/* Pagination Controls */}
        <motion.div
          className="flex items-center justify-center gap-4 mt-4"
          variants={paginationVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Prev button */}
          <motion.button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 0}
            className="flex items-center gap-1 px-4 py-2 rounded-lg font-chinese text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ color: 'var(--text-secondary)' }}
            whileHover={currentPage !== 0 ? { scale: 1.05, color: 'var(--text-primary)' } : {}}
            whileTap={currentPage !== 0 ? { scale: 0.95 } : {}}
          >
            <ChevronLeft className="w-4 h-4" />
            上一页
          </motion.button>

          {/* Dot indicators */}
          <div className="flex items-center gap-2">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => goToPage(i)}
                className="rounded-full transition-all duration-200"
                style={{
                  width: i === currentPage ? '24px' : '8px',
                  height: '8px',
                  backgroundColor: i === currentPage ? 'var(--accent-red)' : 'var(--bg-elevated)',
                  boxShadow: i === currentPage ? '0 0 8px var(--accent-red)' : 'none',
                }}
                aria-label={`第 ${i + 1} 页`}
              />
            ))}
          </div>

          {/* Next button */}
          <motion.button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages - 1}
            className="flex items-center gap-1 px-4 py-2 rounded-lg font-chinese text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ color: 'var(--text-secondary)' }}
            whileHover={currentPage !== totalPages - 1 ? { scale: 1.05, color: 'var(--text-primary)' } : {}}
            whileTap={currentPage !== totalPages - 1 ? { scale: 0.95 } : {}}
          >
            下一页
            <ChevronRight className="w-4 h-4" />
          </motion.button>
        </motion.div>

        {/* Bottom Action Buttons */}
        <motion.div
          className="flex flex-col items-center gap-3 mt-4"
          variants={bottomVariants}
          initial="hidden"
          animate="visible"
        >
          {currentPage === totalPages - 1 && (
            <motion.button
              onClick={handleStart}
              className="btn-primary light-sweep"
              style={{ width: '320px', height: '56px' }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
            >
              进入游戏 开始对决
            </motion.button>
          )}
        </motion.div>
      </div>

      {/* ─── Item Detail Modal ─── */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0"
              style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
              onClick={() => setSelectedItem(null)}
            />

            {/* Modal */}
            <motion.div
              className="relative rounded-xl border p-6 w-full overflow-hidden"
              style={{
                maxWidth: '400px',
                backgroundColor: 'var(--bg-dark)',
                borderColor: 'var(--accent-gold)',
                borderWidth: '2px',
                boxShadow: '0 0 40px rgba(212, 165, 32, 0.2)',
              }}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ duration: 0.3, ease: easeBounce }}
            >
              {/* Close button */}
              <button
                onClick={() => setSelectedItem(null)}
                className="absolute top-3 right-3 p-1 rounded-md transition-colors hover:bg-white/10"
                style={{ color: 'var(--text-dim)' }}
              >
                <X className="w-5 h-5" />
              </button>

              {/* Item icon */}
              <div className="flex flex-col items-center gap-3 mb-4">
                <motion.img
                  src={selectedItem.image}
                  alt={selectedItem.name}
                  className="w-20 h-20 object-contain"
                  draggable={false}
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1, duration: 0.3, ease: easeBounce }}
                />
                <h3
                  className="font-chinese text-xl font-bold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {selectedItem.name}
                </h3>
              </div>

              {/* Divider */}
              <div className="w-full h-px mb-4" style={{ backgroundColor: 'var(--bg-elevated)' }} />

              {/* Description */}
              <p
                className="font-chinese text-sm text-center leading-relaxed mb-4"
                style={{ color: 'var(--text-secondary)' }}
              >
                {selectedItem.description}
              </p>

              {/* Rating */}
              <div className="flex items-center justify-center gap-1 mb-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className="w-4 h-4"
                    style={{
                      color: i < selectedItem.rating ? 'var(--accent-amber)' : 'var(--bg-elevated)',
                      fill: i < selectedItem.rating ? 'var(--accent-amber)' : 'none',
                    }}
                  />
                ))}
                <span
                  className="font-chinese text-xs ml-2"
                  style={{ color: 'var(--accent-amber)' }}
                >
                  {selectedItem.rating >= 5 ? 'S级' : selectedItem.rating >= 4 ? 'A级' : 'B级'}
                </span>
              </div>

              {/* Category */}
              <p
                className="font-chinese text-xs text-center mb-4"
                style={{ color: 'var(--text-dim)' }}
              >
                用途: {selectedItem.category}
              </p>

              {/* Combo tip */}
              {selectedItem.combo && (
                <div
                  className="rounded-md p-3 mb-4 border"
                  style={{
                    backgroundColor: 'rgba(212, 165, 32, 0.1)',
                    borderColor: 'rgba(212, 165, 32, 0.2)',
                  }}
                >
                  <p className="font-chinese text-xs" style={{ color: 'var(--accent-gold)' }}>
                    经典Combo: {selectedItem.combo}
                  </p>
                </div>
              )}

              {/* Tip */}
              {selectedItem.tip && (
                <p
                  className="font-chinese text-xs text-center"
                  style={{ color: 'var(--text-dim)' }}
                >
                  提示: {selectedItem.tip}
                </p>
              )}

              {/* Close button */}
              <motion.button
                onClick={() => setSelectedItem(null)}
                className="w-full mt-4 py-2 rounded-lg font-chinese text-sm font-medium transition-colors border"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  borderColor: 'var(--bg-elevated)',
                }}
                whileHover={{
                  backgroundColor: 'var(--accent-red)',
                  borderColor: 'var(--accent-red)',
                }}
                whileTap={{ scale: 0.98 }}
              >
                关闭
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
