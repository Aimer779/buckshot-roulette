import { create } from 'zustand';

// ─── Types ───────────────────────────────────────────────

export type GamePhase =
  | 'BOOT'
  | 'TITLE'
  | 'TUTORIAL'
  | 'ROUND_START'
  | 'PLAYER_TURN'
  | 'ANIMATING'
  | 'DEALER_TURN'
  | 'ROUND_END'
  | 'GAME_OVER';

export type ShellType = 'live' | 'blank';

export interface Shell {
  type: ShellType;
  revealed: boolean;
}

export type ItemType =
  | 'magnifier'
  | 'handcuffs'
  | 'cigarette'
  | 'beer'
  | 'handsaw'
  | 'adrenaline'
  | 'medicine'
  | 'inverter'
  | 'phone';

export interface Item {
  type: ItemType;
  id: string;
}

export interface GameLog {
  id: string;
  message: string;
  type: 'info' | 'damage' | 'heal' | 'item' | 'system';
  timestamp: number;
}

export interface GameState {
  // Phase
  phase: GamePhase;
  previousPhase: GamePhase | null;

  // HP tracking
  playerHP: number;
  playerMaxHP: number;
  dealerHP: number;
  dealerMaxHP: number;

  // Shell queue
  shells: Shell[];
  currentShellIndex: number;

  // Items
  playerItems: Item[];
  dealerItems: Item[];

  // Round info
  currentRound: number;
  maxRounds: number;

  // Flags
  sawActive: boolean;
  guillotineTriggered: boolean;
  skipDealerTurn: boolean;
  showTutorial: boolean;
  soundEnabled: boolean;
  crtEnabled: boolean;
  musicVolume: number;
  sfxVolume: number;
  itemEffectTipsEnabled: boolean;

  // Game log
  logs: GameLog[];

  // Winner
  winner: 'player' | 'dealer' | null;

  // ─── Actions ──────────────────────────────────────
  setPhase: (phase: GamePhase) => void;
  setHP: (target: 'player' | 'dealer', hp: number) => void;
  damage: (target: 'player' | 'dealer', amount: number) => void;
  heal: (target: 'player' | 'dealer', amount: number) => void;
  loadShells: (shells: Shell[]) => void;
  revealShell: (index: number) => void;
  useCurrentShell: () => Shell | null;
  addItem: (target: 'player' | 'dealer', item: Item) => void;
  removeItem: (target: 'player' | 'dealer', itemId: string) => void;
  setSawActive: (active: boolean) => void;
  setGuillotineTriggered: (triggered: boolean) => void;
  setSkipDealerTurn: (skip: boolean) => void;
  nextRound: () => void;
  retryRound: () => void;
  resetGame: () => void;
  addLog: (message: string, type: GameLog['type']) => void;
  clearLogs: () => void;
  setShowTutorial: (show: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setCrtEnabled: (enabled: boolean) => void;
  setMusicVolume: (volume: number) => void;
  setSfxVolume: (volume: number) => void;
  setItemEffectTipsEnabled: (enabled: boolean) => void;
  setWinner: (winner: 'player' | 'dealer' | null) => void;

  // Convenience
  getLiveCount: () => number;
  getBlankCount: () => number;
  getCurrentShell: () => Shell | null;
  getRemainingShells: () => Shell[];
}

// ─── Helper ──────────────────────────────────────────────

let logIdCounter = 0;
const makeLog = (message: string, type: GameLog['type']): GameLog => ({
  id: `log-${++logIdCounter}`,
  message,
  type,
  timestamp: Date.now(),
});

let itemIdCounter = 0;
export const makeItem = (type: ItemType): Item => ({
  type,
  id: `item-${++itemIdCounter}-${Math.random().toString(36).slice(2, 6)}`,
});

const TUTORIAL_ROUND_COMPLETED_KEY = 'buckshot-roulette:tutorial-round-completed';
const ITEM_EFFECT_TIPS_ENABLED_KEY = 'buckshot-roulette:item-effect-tips-enabled';

const readTutorialPreference = () => {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(TUTORIAL_ROUND_COMPLETED_KEY) !== 'true';
};

const writeTutorialPreference = (showTutorial: boolean) => {
  if (typeof window === 'undefined') return;
  if (showTutorial) {
    window.localStorage.removeItem(TUTORIAL_ROUND_COMPLETED_KEY);
  } else {
    window.localStorage.setItem(TUTORIAL_ROUND_COMPLETED_KEY, 'true');
  }
};

const readItemEffectTipsPreference = () => {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(ITEM_EFFECT_TIPS_ENABLED_KEY) !== 'false';
};

const writeItemEffectTipsPreference = (enabled: boolean) => {
  if (typeof window === 'undefined') return;
  if (enabled) {
    window.localStorage.removeItem(ITEM_EFFECT_TIPS_ENABLED_KEY);
  } else {
    window.localStorage.setItem(ITEM_EFFECT_TIPS_ENABLED_KEY, 'false');
  }
};

const getStartRound = (showTutorial: boolean) => (showTutorial ? 1 : 2);

// ─── Item Info ───────────────────────────────────────────

export const ITEM_INFO: Record<ItemType, { name: string; description: string; image: string }> = {
  magnifier: { name: '放大镜', description: '查看当前枪膛内的子弹', image: '/item-magnifier.png' },
  handcuffs: { name: '手铐', description: '跳过对方下一回合', image: '/item-handcuffs.png' },
  cigarette: { name: '香烟', description: '恢复1点生命值', image: '/item-cigarette.png' },
  beer: { name: '啤酒', description: '弹出当前子弹', image: '/item-beer.png' },
  handsaw: { name: '手锯', description: '下一发伤害翻倍', image: '/item-handsaw.png' },
  adrenaline: { name: '肾上腺素', description: '偷取对方一个道具', image: '/item-adrenaline.png' },
  medicine: { name: '过期药品', description: '50%恢复2生命/50%失去1生命', image: '/item-medicine.png' },
  inverter: { name: '逆变器', description: '翻转当前子弹类型', image: '/item-inverter.png' },
  phone: { name: '手机', description: '随机知晓一个子弹信息', image: '/item-phone.png' },
};

// ─── Default HP by round ─────────────────────────────────

export const ROUND_CONFIG: Record<number, { playerHP: number; dealerHP: number; shellCount: number; itemCount: number }> = {
  1: { playerHP: 2, dealerHP: 2, shellCount: 3, itemCount: 1 },
  2: { playerHP: 4, dealerHP: 4, shellCount: 5, itemCount: 2 },
  3: { playerHP: 6, dealerHP: 6, shellCount: 7, itemCount: 3 },
};

// ─── Store ───────────────────────────────────────────────

const initialState = {
  phase: 'TITLE' as GamePhase,
  previousPhase: null as GamePhase | null,
  playerHP: 2,
  playerMaxHP: 2,
  dealerHP: 2,
  dealerMaxHP: 2,
  shells: [] as Shell[],
  currentShellIndex: 0,
  playerItems: [] as Item[],
  dealerItems: [] as Item[],
  currentRound: 1,
  maxRounds: 3,
  sawActive: false,
  guillotineTriggered: false,
  skipDealerTurn: false,
  showTutorial: readTutorialPreference(),
  soundEnabled: true,
  crtEnabled: true,
  musicVolume: 0.7,
  sfxVolume: 0.8,
  itemEffectTipsEnabled: readItemEffectTipsPreference(),
  logs: [] as GameLog[],
  winner: null as 'player' | 'dealer' | null,
};

export const useGameStore = create<GameState>((set, get) => ({
  ...initialState,

  setPhase: (phase) => set((s) => ({ previousPhase: s.phase, phase })),

  setHP: (target, hp) =>
    set((s) => ({
      ...(target === 'player'
        ? { playerHP: Math.max(0, Math.min(hp, s.playerMaxHP)) }
        : { dealerHP: Math.max(0, Math.min(hp, s.dealerMaxHP)) }),
    })),

  damage: (target, amount) => {
    const s = get();
    const actualDamage = s.sawActive ? amount * 2 : amount;
    const newHP = Math.max(
      0,
      (target === 'player' ? s.playerHP : s.dealerHP) - actualDamage
    );
    set({
      ...(target === 'player' ? { playerHP: newHP } : { dealerHP: newHP }),
      sawActive: false,
    });
    get().addLog(
      `${target === 'player' ? '玩家' : '庄家'}受到 ${actualDamage} 点伤害！`,
      'damage'
    );
  },

  heal: (target, amount) => {
    const s = get();
    const maxHP = target === 'player' ? s.playerMaxHP : s.dealerMaxHP;
    const newHP = Math.min(maxHP, (target === 'player' ? s.playerHP : s.dealerHP) + amount);
    set({
      ...(target === 'player' ? { playerHP: newHP } : { dealerHP: newHP }),
    });
    get().addLog(
      `${target === 'player' ? '玩家' : '庄家'}恢复 ${amount} 点生命值`,
      'heal'
    );
  },

  loadShells: (shells) =>
    set({ shells, currentShellIndex: 0 }),

  revealShell: (index) =>
    set((s) => ({
      shells: s.shells.map((sh, i) => (i === index ? { ...sh, revealed: true } : sh)),
    })),

  useCurrentShell: () => {
    const s = get();
    if (s.currentShellIndex >= s.shells.length) return null;
    const shell = s.shells[s.currentShellIndex];
    set({ currentShellIndex: s.currentShellIndex + 1 });
    return shell;
  },

  addItem: (target, item) =>
    set((s) => ({
      ...(target === 'player'
        ? { playerItems: [...s.playerItems, item] }
        : { dealerItems: [...s.dealerItems, item] }),
    })),

  removeItem: (target, itemId) =>
    set((s) => ({
      ...(target === 'player'
        ? { playerItems: s.playerItems.filter((i) => i.id !== itemId) }
        : { dealerItems: s.dealerItems.filter((i) => i.id !== itemId) }),
    })),

  setSawActive: (active) => set({ sawActive: active }),

  setGuillotineTriggered: (triggered) => set({ guillotineTriggered: triggered }),

  setSkipDealerTurn: (skip) => set({ skipDealerTurn: skip }),

  nextRound: () => {
    const s = get();
    const next = s.currentRound + 1;
    if (next > s.maxRounds) {
      // Game should be over - determine winner by HP
      const winner = s.playerHP > s.dealerHP ? 'player' : 'dealer';
      set({ phase: 'GAME_OVER', winner });
    } else {
      const config = ROUND_CONFIG[next] || ROUND_CONFIG[3];
      if (s.currentRound === 1) {
        writeTutorialPreference(false);
      }
      set({
        currentRound: next,
        playerHP: config.playerHP,
        playerMaxHP: config.playerHP,
        dealerHP: config.dealerHP,
        dealerMaxHP: config.dealerHP,
        shells: [],
        currentShellIndex: 0,
        sawActive: false,
        skipDealerTurn: false,
        phase: 'ROUND_START',
      });
    }
  },

  retryRound: () => {
    const s = get();
    const config = ROUND_CONFIG[s.currentRound] || ROUND_CONFIG[3];
    set({
      playerHP: config.playerHP,
      playerMaxHP: config.playerHP,
      dealerHP: config.dealerHP,
      dealerMaxHP: config.dealerHP,
      shells: [],
      currentShellIndex: 0,
      playerItems: [],
      dealerItems: [],
      sawActive: false,
      skipDealerTurn: false,
      guillotineTriggered: false,
      phase: 'ROUND_START',
    });
  },

  resetGame: () => {
    const showTutorial = readTutorialPreference();
    const itemEffectTipsEnabled = readItemEffectTipsPreference();
    const startRound = getStartRound(showTutorial);
    const config = ROUND_CONFIG[startRound];
    set({
      ...initialState,
      showTutorial,
      itemEffectTipsEnabled,
      currentRound: startRound,
      playerHP: config.playerHP,
      playerMaxHP: config.playerHP,
      dealerHP: config.dealerHP,
      dealerMaxHP: config.dealerHP,
      phase: 'TITLE',
      logs: [],
    });
  },

  addLog: (message, type) =>
    set((s) => ({
      logs: [makeLog(message, type), ...s.logs].slice(0, 100),
    })),

  clearLogs: () => set({ logs: [] }),

  setShowTutorial: (show) => {
    writeTutorialPreference(show);
    set({ showTutorial: show });
  },

  setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),

  setCrtEnabled: (enabled) => set({ crtEnabled: enabled }),

  setMusicVolume: (volume) => set({ musicVolume: volume }),

  setSfxVolume: (volume) => set({ sfxVolume: volume }),

  setItemEffectTipsEnabled: (enabled) => {
    writeItemEffectTipsPreference(enabled);
    set({ itemEffectTipsEnabled: enabled });
  },

  setWinner: (winner) => set({ winner }),

  // Convenience getters
  getLiveCount: () => get().shells.filter((s) => s.type === 'live').length,

  getBlankCount: () => get().shells.filter((s) => s.type === 'blank').length,

  getCurrentShell: () => {
    const s = get();
    if (s.currentShellIndex >= s.shells.length) return null;
    return s.shells[s.currentShellIndex];
  },

  getRemainingShells: () => {
    const s = get();
    return s.shells.slice(s.currentShellIndex);
  },
}));
