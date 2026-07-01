import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  Crosshair,
  Shield,
  AlertTriangle,
  Sparkles,
  Cigarette,
} from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import {
  loadShells,
  distributeItems,
  dealerDecision,
  checkGameOver,
} from '@/lib/gameEngine';
import { playSFX, playBGM } from '@/lib/sound';
import HealthBar from '@/components/HealthBar';
import ItemCard from '@/components/ItemCard';
import ShellIndicator from '@/components/ShellIndicator';
import MessageToast from '@/components/MessageToast';
import GameLogPanel from '@/components/GameLogPanel';
import type { Item } from '@/store/gameStore';

// ─── Types ───────────────────────────────────────────────

interface ToastMsg {
  id: string;
  message: string;
  type: 'info' | 'damage' | 'heal' | 'item' | 'system';
}

// ─── Helpers ─────────────────────────────────────────────

let toastId = 0;
const makeToast = (
  message: string,
  type: ToastMsg['type'] = 'info'
): ToastMsg => ({
  id: `toast-${++toastId}`,
  message,
  type,
});

const ITEM_EFFECT_DURATION = 1200;

const ROUND_LABELS: Record<number, { text: string; color: string; bg: string }> = {
  1: { text: '教学回合', color: 'var(--accent-blue)', bg: 'rgba(59, 130, 246, 0.2)' },
  2: { text: '道具回合', color: 'var(--accent-amber)', bg: 'rgba(245, 158, 11, 0.2)' },
  3: { text: '最终对决', color: 'var(--accent-red)', bg: 'rgba(220, 38, 38, 0.2)' },
};

// ─── Component ───────────────────────────────────────────

export default function GameplayScreen() {
  const navigate = useNavigate();

  // ── Store state selectors ──
  const {
    phase,
    setPhase,
    playerHP,
    playerMaxHP,
    dealerHP,
    dealerMaxHP,
    shells,
    currentShellIndex,
    loadShells: storeLoadShells,
    playerItems,
    dealerItems,
    currentRound,
    maxRounds,
    sawActive,
    guillotineTriggered,
    skipDealerTurn,
    damage,
    heal,
    addItem,
    removeItem,
    setSawActive,
    setGuillotineTriggered,
    setSkipDealerTurn,
    revealShell,
    addLog,
    setWinner,
    nextRound,
    retryRound,
  } = useGameStore();

  // ── Local UI state ──
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [roundAnnounce, setRoundAnnounce] = useState(false);
  const [dealerThinking, setDealerThinking] = useState(false);
  const [shootingAnim, setShootingAnim] = useState<'self' | 'dealer' | null>(null);
  const [muzzleFlash, setMuzzleFlash] = useState(false);
  const [bloodFlash, setBloodFlash] = useState(false);
  const [shakeScreen, setShakeScreen] = useState(false);
  const [shellEjectAnim, setShellEjectAnim] = useState(false);
  const [ejectedShellType, setEjectedShellType] = useState<'live' | 'blank' | null>(null);
  const [showGuillotineWarning, setShowGuillotineWarning] = useState(false);
  const [itemEffectAnim, setItemEffectAnim] = useState<string | null>(null);
  const [revealedShellIndex, setRevealedShellIndex] = useState<number | null>(null);
  const [damageFloatingText, setDamageFloatingText] = useState<{
    text: string;
    target: 'player' | 'dealer';
  } | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const animLockRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRoundRef = useRef<number | null>(null);
  const pendingRoundEndRef = useRef<'won' | 'lost' | null>(null);

  // ── Toast helpers ──
  const pushToast = useCallback(
    (message: string, type: ToastMsg['type'] = 'info') => {
      const t = makeToast(message, type);
      setToasts((prev) => [t, ...prev].slice(0, 5));
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Blood flash effect ──
  const triggerBloodFlash = useCallback(() => {
    setBloodFlash(true);
    setTimeout(() => setBloodFlash(false), 900);
  }, []);

  // ── Screen shake ──
  const triggerShake = useCallback(() => {
    setShakeScreen(true);
    setTimeout(() => setShakeScreen(false), 300);
  }, []);

  // ── Muzzle flash ──
  const triggerMuzzleFlash = useCallback(() => {
    setMuzzleFlash(true);
    setTimeout(() => setMuzzleFlash(false), 250);
  }, []);

  // ── Floating damage text ──
  const showDamageText = useCallback(
    (text: string, target: 'player' | 'dealer') => {
      setDamageFloatingText({ text, target });
      setTimeout(() => setDamageFloatingText(null), 1000);
    },
    []
  );

  // ── Initialize game ──
  useEffect(() => {
    playBGM('gameplay');
    // Only init on first mount
    if (!isInitialized) {
      setIsInitialized(true);
      initRound(true);
    }
  }, []);

  // ── Check guillotine trigger ──
  useEffect(() => {
    if (currentRound === 3 && !guillotineTriggered) {
      if (playerHP <= 2 || dealerHP <= 2) {
        setGuillotineTriggered(true);
        playSFX('guillotine-drop');
        setShowGuillotineWarning(true);
        pushToast('闸刀已触发！恢复类道具失效！', 'damage');
        addLog('闸刀已触发！恢复类道具失效！', 'damage');
        setTimeout(() => setShowGuillotineWarning(false), 4000);
      }
    }
  }, [playerHP, dealerHP, currentRound, guillotineTriggered]);

  // ── Check game over / round advance ──
  useEffect(() => {
    if (phase === 'GAME_OVER' || phase === 'ROUND_END' || phase === 'ROUND_START') return;
    const result = checkGameOver(playerHP, dealerHP, currentRound, maxRounds);
    if (result === 'continue') return;

    if (result === 'round-won') {
      pendingRoundEndRef.current = 'won';
      setPhase('ROUND_END');
      pushToast(`第 ${currentRound} 回合胜利！进入下一回合`, 'heal');
      addLog(`第 ${currentRound} 回合结束，进入下一回合`, 'system');
      return;
    }

    if (result === 'round-lost') {
      pendingRoundEndRef.current = 'lost';
      setPhase('ROUND_END');
      pushToast(`第 ${currentRound} 回合失败…复活后重试本回合`, 'damage');
      addLog(`第 ${currentRound} 回合结束，复活后重试`, 'system');
      return;
    }

    // Game over
    setWinner(result);
    setPhase('GAME_OVER');
    pushToast(
      result === 'player' ? '恭喜！你赢得了游戏！' : '游戏结束...',
      result === 'player' ? 'heal' : 'damage'
    );
  }, [
    playerHP,
    dealerHP,
    currentRound,
    phase,
    maxRounds,
    setWinner,
    setPhase,
    pushToast,
    addLog,
  ]);

  // ── Delayed navigation to game over screen ──
  // Split from the detection effect above so the timer can be cleaned up if
  // the player leaves (e.g. "返回主菜单") before it fires. Otherwise the
  // pending navigate('/gameover') would run after resetGame() cleared the
  // winner, landing on a misleading defeat screen.
  useEffect(() => {
    if (phase !== 'GAME_OVER') return;
    const timer = setTimeout(() => {
      navigate('/gameover');
    }, 2500);
    return () => clearTimeout(timer);
  }, [phase, navigate]);

  // ── Round end transition (delayed next/retry) ──
  useEffect(() => {
    if (phase !== 'ROUND_END') return;
    const transition = pendingRoundEndRef.current;
    if (!transition) return;
    pendingRoundEndRef.current = null;

    const timer = setTimeout(() => {
      if (transition === 'won') {
        nextRound();
      } else {
        initializedRoundRef.current = null;
        retryRound();
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [phase, nextRound, retryRound]);

  // ── Init round ──
  const initRound = useCallback(
    (first = false) => {
      const s = useGameStore.getState();
      const round = s.currentRound;
      const newShells = loadShells(round);
      const items = distributeItems(round);

      initializedRoundRef.current = round;
      storeLoadShells(newShells);
      useGameStore.setState({ playerItems: [], dealerItems: [] });
      items.player.forEach((item) => addItem('player', item));
      items.dealer.forEach((item) => addItem('dealer', item));

      setSawActive(false);
      setSkipDealerTurn(false);
      setPhase('ROUND_START');
      addLog(`第 ${round} 回合开始`, 'system');

      const liveC = newShells.filter((sh) => sh.type === 'live').length;
      const blankC = newShells.filter((sh) => sh.type === 'blank').length;
      pushToast(`第 ${round} 回合开始 · 实弹 ${liveC} 发 | 空包弹 ${blankC} 发`, 'system');

      // Round announcement animation
      setRoundAnnounce(true);

      setTimeout(() => {
        setRoundAnnounce(false);
        // Small delay before player turn
        setTimeout(() => {
          setPhase('PLAYER_TURN');
          addLog('玩家回合', 'info');
          pushToast('你的回合', 'info');
        }, 500);
      }, first ? 2500 : 2000);
    },
    [
      storeLoadShells,
      addItem,
      addLog,
      setSawActive,
      setSkipDealerTurn,
      setPhase,
      pushToast,
    ]
  );

  // ── Initialize rounds after nextRound() advances state ──
  useEffect(() => {
    if (!isInitialized || phase !== 'ROUND_START') return;
    if (initializedRoundRef.current === currentRound) return;
    initRound(false);
  }, [isInitialized, phase, currentRound, initRound]);

  // ── Shell reload (when spent or no live shells remain) ──
  const reloadShells = useCallback(
    (reason: 'empty' | 'no-live') => {
      const s = useGameStore.getState();
      const newShells = loadShells(s.currentRound);
      storeLoadShells(newShells);
      const liveC = newShells.filter((sh) => sh.type === 'live').length;
      const blankC = newShells.filter((sh) => sh.type === 'blank').length;
      const message =
        reason === 'empty'
          ? '子弹已耗尽，重新装填'
          : '剩余子弹均为空包弹，重新装填';
      addLog(`${message} · 实弹 ${liveC} 发 | 空包弹 ${blankC} 发`, 'system');
    },
    [storeLoadShells, addLog]
  );

  const reloadIfEmptyOrAllBlank = useCallback((): {
    reloaded: boolean;
    reason: 'empty' | 'no-live' | null;
  } => {
    const s = useGameStore.getState();
    const remaining = s.shells.slice(s.currentShellIndex);
    if (remaining.length === 0) {
      reloadShells('empty');
      return { reloaded: true, reason: 'empty' };
    }
    if (remaining.every((sh) => sh.type === 'blank')) {
      reloadShells('no-live');
      return { reloaded: true, reason: 'no-live' };
    }
    return { reloaded: false, reason: null };
  }, [reloadShells]);

  // ── Shooting animation sequence ──
  const playShootSequence = useCallback(
    (
      target: 'self' | 'dealer',
      onComplete: (shellType: 'live' | 'blank') => void
    ) => {
      if (animLockRef.current) return;
      animLockRef.current = true;

      const s = useGameStore.getState();
      const shell = s.useCurrentShell();
      if (!shell) {
        animLockRef.current = false;
        onComplete('blank');
        return;
      }

      setEjectedShellType(shell.type);
      setPhase('ANIMATING');
      setShootingAnim(target);

      // Step 1: Aim (200ms)
      playSFX('shotgun-pump');

      setTimeout(() => {
        // Step 2: Fire (500ms mark)
        triggerShake();
        triggerMuzzleFlash();

        if (shell.type === 'live') {
          playSFX('shotgun-fire');
        } else {
          playSFX('shotgun-click');
        }

        // Step 3: Shell eject (500ms mark)
        setShellEjectAnim(true);
        playSFX('shell-eject');
        setTimeout(() => {
          setShellEjectAnim(false);
        }, 800);

        // Step 4: Result
        setTimeout(() => {
          setShootingAnim(null);
          animLockRef.current = false;
          onComplete(shell.type);
        }, 600);
      }, 400);
    },
    [setPhase, triggerShake, triggerMuzzleFlash]
  );

  // ── Handle shoot self ──
  const handleShootSelf = useCallback(() => {
    if (phase !== 'PLAYER_TURN' || animLockRef.current) return;

    playShootSequence('self', (shellType) => {
      if (shellType === 'live') {
        const dmg = sawActive ? 2 : 1;
        triggerBloodFlash();
        damage('player', dmg);
        playSFX('damage');
        showDamageText(`-${dmg}`, 'player');
        setSawActive(false);

        setTimeout(() => {
          const ns = useGameStore.getState();
          if (ns.playerHP > 0 && ns.dealerHP > 0) {
            if (reloadIfEmptyOrAllBlank().reloaded) {
              setTimeout(() => setPhase('DEALER_TURN'), 500);
            } else {
              setPhase('DEALER_TURN');
            }
          }
        }, 1200);
      } else {
        setTimeout(() => {
          reloadIfEmptyOrAllBlank();
          setPhase('PLAYER_TURN');
        }, 600);
      }
    });
  }, [
    phase,
    sawActive,
    playShootSequence,
    damage,
    setSawActive,
    triggerBloodFlash,
    showDamageText,
    reloadIfEmptyOrAllBlank,
    setPhase,
  ]);

  // ── Handle shoot dealer ──
  const handleShootDealer = useCallback(() => {
    if (phase !== 'PLAYER_TURN' || animLockRef.current) return;

    playShootSequence('dealer', (shellType) => {
      if (shellType === 'live') {
        const dmg = sawActive ? 2 : 1;
        damage('dealer', dmg);
        playSFX('damage');
        showDamageText(`-${dmg}`, 'dealer');
        setSawActive(false);
      }

      setTimeout(() => {
        const ns = useGameStore.getState();
        if (ns.playerHP > 0 && ns.dealerHP > 0) {
          if (reloadIfEmptyOrAllBlank().reloaded) {
            setTimeout(() => setPhase('DEALER_TURN'), 500);
          } else {
            setPhase('DEALER_TURN');
          }
        }
      }, 1200);
    });
  }, [
    phase,
    sawActive,
    playShootSequence,
    damage,
    setSawActive,
    showDamageText,
    reloadIfEmptyOrAllBlank,
    setPhase,
  ]);

  // ── Dealer turn ──
  useEffect(() => {
    if (phase !== 'DEALER_TURN') return;

    const timer = setTimeout(() => {
      const s = useGameStore.getState();
      if (s.dealerHP <= 0 || s.playerHP <= 0) return;

      // Check handcuffs skip
      if (s.skipDealerTurn) {
        setSkipDealerTurn(false);
        addLog('庄家被手铐束缚，跳过回合', 'info');
        setTimeout(() => {
          reloadIfEmptyOrAllBlank();
          setPhase('PLAYER_TURN');
          pushToast('你的回合', 'info');
        }, 1000);
        return;
      }

      // Avoid dealer thinking over an empty or all-blank magazine
      if (reloadIfEmptyOrAllBlank().reloaded) {
        setTimeout(() => {
          setPhase('PLAYER_TURN');
          pushToast('你的回合', 'info');
        }, 600);
        return;
      }

      setDealerThinking(true);
      addLog('庄家思考中...', 'info');

      const remainingShells = s.shells.slice(s.currentShellIndex);
      const liveCount = remainingShells.filter((sh) => sh.type === 'live').length;
      const blankCount = remainingShells.filter((sh) => sh.type === 'blank').length;

      const decision = dealerDecision(
        s.dealerHP,
        s.playerHP,
        liveCount,
        blankCount,
        remainingShells.length,
        s.dealerItems,
        s.sawActive
      );

      // Simulate thinking time 2-3s
      setTimeout(() => {
        setDealerThinking(false);

        // Execute dealer decision
        if (decision.action === 'use-item' && decision.itemId) {
          const item = s.dealerItems.find((i) => i.id === decision.itemId);
          if (item) {
            executeDealerItemUse(item);
            setTimeout(() => executeDealerShoot(), 1200);
          } else {
            executeDealerShoot();
          }
        } else {
          executeDealerShoot();
        }
      }, 2000 + Math.random() * 1000);
    }, 600);

    return () => clearTimeout(timer);
  }, [
    phase,
    shells,
    currentShellIndex,
    reloadIfEmptyOrAllBlank,
    setPhase,
    setSkipDealerTurn,
    pushToast,
    addLog,
  ]);

  // ── Execute dealer item use ──
  const executeDealerItemUse = useCallback(
    (item: Item) => {
      const s = useGameStore.getState();

      switch (item.type) {
        case 'cigarette':
          if (s.dealerHP < s.dealerMaxHP) {
            heal('dealer', 1);
            removeItem('dealer', item.id);
            playSFX('item-use');
            addLog('庄家使用了香烟', 'item');
          }
          break;
        case 'handsaw':
          if (!s.sawActive) {
            setSawActive(true);
            removeItem('dealer', item.id);
            playSFX('saw');
            addLog('庄家使用了手锯，下一发伤害翻倍', 'item');
          }
          break;
        case 'handcuffs':
          setSkipDealerTurn(true);
          removeItem('dealer', item.id);
          playSFX('metal-clank');
          addLog('庄家使用了手铐', 'item');
          break;
        case 'beer': {
          const shell = s.getCurrentShell();
          if (shell) {
            const st = shell.type;
            addLog(`庄家啤酒弹出了${st === 'live' ? '实弹' : '空包弹'}`, 'item');
            useGameStore.getState().useCurrentShell();
            removeItem('dealer', item.id);
            playSFX('glass-break');
          }
          break;
        }
        case 'magnifier': {
          const shell = s.getCurrentShell();
          if (shell) {
            revealShell(s.currentShellIndex);
            addLog(`庄家查看了子弹`, 'item');
            removeItem('dealer', item.id);
            playSFX('item-use');
          }
          break;
        }
        default:
          removeItem('dealer', item.id);
          playSFX('item-use');
          break;
      }
    },
    [heal, removeItem, setSawActive, setSkipDealerTurn, revealShell, addLog]
  );

  // ── Execute dealer shoot ──
  const executeDealerShoot = useCallback(() => {
    const s = useGameStore.getState();
    const remainingShells = s.shells.slice(s.currentShellIndex);

    // Defensive: skip an empty or all-blank magazine before the dealer acts
    if (reloadIfEmptyOrAllBlank().reloaded) {
      setTimeout(() => {
        setPhase('PLAYER_TURN');
        pushToast('你的回合', 'info');
      }, 600);
      return;
    }

    const liveCount = remainingShells.filter((sh) => sh.type === 'live').length;
    const blankCount = remainingShells.filter((sh) => sh.type === 'blank').length;

    // Simple decision: if more blanks, shoot self; else shoot player
    const blankRatio = blankCount / (liveCount + blankCount);
    const shootSelf = blankRatio > 0.5;

    playShootSequence(shootSelf ? 'self' : 'dealer', (shellType) => {
      if (shootSelf) {
        // Dealer shoots self
        if (shellType === 'live') {
          const dmg = s.sawActive ? 2 : 1;
          damage('dealer', dmg);
          playSFX('damage');
          showDamageText(`-${dmg}`, 'dealer');
          setSawActive(false);

          setTimeout(() => {
            const ns = useGameStore.getState();
            if (ns.dealerHP > 0 && ns.playerHP > 0) {
              if (reloadIfEmptyOrAllBlank().reloaded) {
                setTimeout(() => {
                  setPhase('PLAYER_TURN');
                  pushToast('你的回合', 'info');
                }, 600);
              } else {
                setPhase('PLAYER_TURN');
                pushToast('你的回合', 'info');
              }
            }
          }, 1200);
        } else {
          setTimeout(() => {
            // Dealer gets extra turn - recurse
            const ns = useGameStore.getState();
            if (ns.currentShellIndex >= ns.shells.length) {
              // Magazine physically empty: reload and pass turn to player
              reloadIfEmptyOrAllBlank();
              setTimeout(() => {
                setPhase('PLAYER_TURN');
                pushToast('你的回合', 'info');
              }, 600);
            } else {
              // If remaining shells are all blanks, reload and pass turn to player
              if (reloadIfEmptyOrAllBlank().reloaded) {
                setTimeout(() => {
                  setPhase('PLAYER_TURN');
                  pushToast('你的回合', 'info');
                }, 600);
              } else {
                setPhase('DEALER_TURN');
              }
            }
          }, 1000);
        }
      } else {
        // Dealer shoots player
        if (shellType === 'live') {
          const dmg = s.sawActive ? 2 : 1;
          triggerBloodFlash();
          damage('player', dmg);
          playSFX('damage');
          showDamageText(`-${dmg}`, 'player');
          setSawActive(false);
        }

        setTimeout(() => {
          const ns = useGameStore.getState();
          if (ns.dealerHP > 0 && ns.playerHP > 0) {
            if (reloadIfEmptyOrAllBlank().reloaded) {
              setTimeout(() => {
                setPhase('PLAYER_TURN');
                pushToast('你的回合', 'info');
              }, 600);
            } else {
              setPhase('PLAYER_TURN');
              pushToast('你的回合', 'info');
            }
          }
        }, 1200);
      }
    });
  }, [
    playShootSequence,
    damage,
    setSawActive,
    pushToast,
    triggerBloodFlash,
    showDamageText,
    reloadIfEmptyOrAllBlank,
    setPhase,
  ]);

  // ── Handle player item use ──
  const handleUseItem = useCallback(
    (item: Item) => {
      if (phase !== 'PLAYER_TURN' || animLockRef.current) return;

      const s = useGameStore.getState();

      switch (item.type) {
        // ─── 香烟: heal 1 ───
        case 'cigarette': {
          // Guillotine blocks healing
          if (guillotineTriggered) {
            return;
          }
          if (playerHP < playerMaxHP) {
            heal('player', 1);
            removeItem('player', item.id);
            playSFX('item-use');
            setItemEffectAnim('cigarette');
            setTimeout(() => setItemEffectAnim(null), ITEM_EFFECT_DURATION);
          }
          break;
        }

        // ─── 手锯: double damage ───
        case 'handsaw':
          if (!sawActive) {
            setSawActive(true);
            removeItem('player', item.id);
            playSFX('saw');
            setItemEffectAnim('handsaw');
            addLog('手锯已装备，下一发伤害翻倍', 'item');
            setTimeout(() => setItemEffectAnim(null), ITEM_EFFECT_DURATION);
          }
          break;

        // ─── 手铐: skip dealer turn ───
        case 'handcuffs':
          setSkipDealerTurn(true);
          removeItem('player', item.id);
          playSFX('metal-clank');
          setItemEffectAnim('handcuffs');
          addLog('手铐已使用，庄家下回合被跳过', 'item');
          setTimeout(() => setItemEffectAnim(null), ITEM_EFFECT_DURATION);
          break;

        // ─── 啤酒: eject current shell ───
        case 'beer': {
          const shell = s.getCurrentShell();
          if (shell) {
            const st = shell.type;
            addLog(`啤酒弹出了${st === 'live' ? '实弹' : '空包弹'}`, 'item');
            useGameStore.getState().useCurrentShell();
            removeItem('player', item.id);
            playSFX('glass-break');
            setItemEffectAnim('beer');
            setEjectedShellType(st);
            setShellEjectAnim(true);
            setTimeout(() => {
              setItemEffectAnim(null);
              setShellEjectAnim(false);
              reloadIfEmptyOrAllBlank();
            }, ITEM_EFFECT_DURATION);
          }
          break;
        }

        // ─── 放大镜: reveal current shell ───
        case 'magnifier': {
          const shell = s.getCurrentShell();
          if (shell) {
            revealShell(s.currentShellIndex);
            setRevealedShellIndex(s.currentShellIndex);
            addLog(`当前子弹: ${shell.type === 'live' ? '实弹' : '空包弹'}`, 'item');
            removeItem('player', item.id);
            playSFX('item-use');
            setItemEffectAnim('magnifier');
            setTimeout(() => {
              setItemEffectAnim(null);
              setRevealedShellIndex(null);
            }, 2000);
          }
          break;
        }

        // ─── 肾上腺素: steal dealer item ───
        case 'adrenaline': {
          if (s.dealerItems.length === 0) {
            return;
          }
          const randomIdx = Math.floor(Math.random() * s.dealerItems.length);
          const stolen = s.dealerItems[randomIdx];
          if (stolen) {
            removeItem('dealer', stolen.id);
            addItem('player', stolen);
            removeItem('player', item.id);
            playSFX('item-use');
            setItemEffectAnim('adrenaline');
            addLog('偷取了庄家的道具', 'item');
            setTimeout(() => setItemEffectAnim(null), ITEM_EFFECT_DURATION);
          }
          break;
        }

        // ─── 过期药品: 50% +2 HP, 50% -1 HP ───
        case 'medicine': {
          if (guillotineTriggered) {
            return;
          }
          const roll = Math.random();
          removeItem('player', item.id);
          playSFX('item-use');
          setItemEffectAnim('medicine');

          if (roll < 0.5) {
            heal('player', 2);
            addLog('过期药品生效，恢复 2 点生命', 'heal');
          } else {
            damage('player', 1);
            triggerBloodFlash();
            showDamageText('-1', 'player');
            addLog('过期药品失效，失去 1 点生命', 'damage');
          }
          setTimeout(() => setItemEffectAnim(null), ITEM_EFFECT_DURATION);
          break;
        }

        // ─── 逆变器: flip current shell ───
        case 'inverter': {
          const curShell = s.getCurrentShell();
          if (curShell) {
            const newType = curShell.type === 'live' ? 'blank' : 'live';
            useGameStore.setState((state) => ({
              shells: state.shells.map((sh, i) =>
                i === state.currentShellIndex ? { ...sh, type: newType } : sh
              ),
            }));
            removeItem('player', item.id);
            playSFX('item-use');
            setItemEffectAnim('inverter');
            addLog(`逆变器翻转了子弹类型`, 'item');
            setTimeout(() => setItemEffectAnim(null), ITEM_EFFECT_DURATION);
          }
          break;
        }

        // ─── 一次性手机: reveal random future shell ───
        case 'phone': {
          const futureIndices: number[] = [];
          for (let i = s.currentShellIndex + 1; i < s.shells.length; i++) {
            if (!s.shells[i].revealed) {
              futureIndices.push(i);
            }
          }
          removeItem('player', item.id);
          playSFX('phone-ring');
          setItemEffectAnim('phone');

          if (futureIndices.length > 0) {
            const ri = futureIndices[Math.floor(Math.random() * futureIndices.length)];
            revealShell(ri);
            addLog(`手机揭示了第 ${ri - s.currentShellIndex} 发子弹`, 'item');
          }
          setTimeout(() => setItemEffectAnim(null), ITEM_EFFECT_DURATION);
          break;
        }

        default:
          break;
      }
    },
    [
      phase,
      playerHP,
      playerMaxHP,
      sawActive,
      guillotineTriggered,
      heal,
      damage,
      removeItem,
      addItem,
      setSawActive,
      setSkipDealerTurn,
      revealShell,
      addLog,
      triggerBloodFlash,
      showDamageText,
      reloadIfEmptyOrAllBlank,
    ]
  );

  // ── Settings ──
  const handleQuit = useCallback(() => {
    setSettingsOpen(false);
    setPhase('TITLE');
    useGameStore.getState().resetGame();
    navigate('/');
  }, [setPhase, navigate]);

  // ── Derived state ──
  const isPlayerTurn = phase === 'PLAYER_TURN';
  const actionsEnabled = isPlayerTurn && !animLockRef.current && !roundAnnounce;
  const roundLabel = ROUND_LABELS[currentRound] || ROUND_LABELS[3];

  // ─── Render ─────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className="relative min-h-[100dvh] w-full overflow-hidden select-none"
      style={{ backgroundColor: 'var(--bg-void)' }}
    >
      {/* Background */}
      <div
        className="fixed inset-0 z-0 opacity-40"
        style={{
          backgroundImage: 'url(/bg-gameplay.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      {/* Screen shake wrapper */}
      <motion.div
        animate={
          shakeScreen
            ? {
                x: [0, -4, 4, -3, 3, -2, 2, 0],
                y: [0, 2, -3, 2, -2, 1, -1, 0],
              }
            : {}
        }
        transition={{ duration: 0.3 }}
        className="relative z-10 min-h-[100dvh] flex flex-col"
      >
        {/* ═══ Top HUD Bar ═══ */}
        <div
          className="grid grid-cols-[1fr_auto_1fr] items-center px-4 py-2 shrink-0"
          style={{
            backgroundColor: 'rgba(10, 10, 15, 0.7)',
            backdropFilter: 'blur(6px)',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            height: '48px',
          }}
        >
          {/* Left: Round info */}
          <div className="flex items-center gap-2">
            <span
              className="font-chinese text-sm font-medium tracking-wider"
              style={{ color: 'var(--text-primary)' }}
            >
              第{' '}
              <span
                className="font-bold"
                style={{ color: 'var(--accent-red)', fontSize: '18px' }}
              >
                {currentRound}
              </span>{' '}
              回合 / 共{maxRounds}回合
            </span>
            <span
              className="font-chinese text-xs px-2 py-0.5 rounded-full"
              style={{
                color: roundLabel.color,
                backgroundColor: roundLabel.bg,
              }}
            >
              {roundLabel.text}
            </span>
            {sawActive && (
              <span
                className="flex items-center gap-1 font-chinese text-xs px-2 py-0.5 rounded-full border"
                style={{
                  color: 'var(--accent-red)',
                  borderColor: 'var(--accent-red)',
                  backgroundColor: 'rgba(220, 38, 38, 0.2)',
                }}
              >
                <Crosshair className="w-3 h-3" />
                手锯
              </span>
            )}
            {skipDealerTurn && (
              <span
                className="flex items-center gap-1 font-chinese text-xs px-2 py-0.5 rounded-full border"
                style={{
                  color: 'var(--accent-gold)',
                  borderColor: 'var(--accent-gold)',
                  backgroundColor: 'rgba(212, 165, 32, 0.2)',
                }}
              >
                <Shield className="w-3 h-3" />
                跳过
              </span>
            )}
          </div>

          {/* Center: Phase message */}
          <div className="hidden sm:flex items-center gap-2">
            <AnimatePresence mode="wait">
              <motion.span
                key={phase + (dealerThinking ? '-thinking' : '')}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="font-chinese text-base font-medium"
                style={{ color: 'var(--text-primary)' }}
              >
                {phase === 'ROUND_START' && '回合开始'}
                {phase === 'PLAYER_TURN' && '你的回合'}
                {phase === 'DEALER_TURN' && (dealerThinking ? '庄家思考中...' : '庄家行动中')}
                {phase === 'ANIMATING' && '...'}
                {phase === 'GAME_OVER' && '游戏结束'}
              </motion.span>
            </AnimatePresence>
          </div>

          {/* Right: Settings */}
          <div className="flex items-center justify-end">
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className="p-2 rounded-lg transition-all hover:bg-white/5"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ═══ Game Log + Main Game Area ═══ */}
        <div className="relative flex-1 flex overflow-hidden">
          <GameLogPanel />

          {/* ═══ Main Game Area ═══ */}
          <div className="flex-1 flex flex-col items-center justify-between px-4 py-2 sm:py-4 relative overflow-y-auto">
          {/* ─── Dealer Section ─── */}
          <div className="w-full max-w-4xl flex flex-col items-center gap-2">
            {/* Dealer HP */}
            <div className="flex items-center gap-3">
              <HealthBar
                current={dealerHP}
                max={dealerMaxHP}
                label="庄家"
                isDealer
              />
            </div>

            {/* Dealer items */}
            {dealerItems.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                {dealerItems.map((item) => (
                  <ItemCard key={item.id} item={item} size="sm" disabled />
                ))}
              </div>
            )}

            {/* Dealer silhouette */}
            <motion.div
              animate={
                phase === 'DEALER_TURN'
                  ? { y: 5, scale: 1.02 }
                  : { y: 0, scale: 1 }
              }
              transition={{ duration: 0.5 }}
              className="relative"
            >
              <img
                src="/dealer-silhouette.png"
                alt="庄家"
                className="w-[120px] h-auto sm:w-[160px] md:w-[200px] object-contain"
                draggable={false}
                style={{
                  filter:
                    phase === 'DEALER_TURN'
                      ? 'drop-shadow(0 0 20px rgba(220, 38, 38, 0.5))'
                      : 'drop-shadow(0 0 10px rgba(220, 38, 38, 0.2))',
                  transition: 'filter 0.5s',
                }}
              />
              {/* Red eye glow on dealer turn */}
              {phase === 'DEALER_TURN' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0.3, 0.8, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute top-[35%] left-[45%] w-2 h-1 rounded-full"
                  style={{
                    backgroundColor: 'var(--accent-red)',
                    boxShadow: '0 0 10px var(--accent-red)',
                  }}
                />
              )}
            </motion.div>
          </div>

          {/* ─── Central Game Area ─── */}
          <div className="flex flex-col items-center gap-4 relative">
            {/* Shell info panel */}
            <div
              className="flex flex-col items-center gap-2 px-6 py-3 rounded-xl"
              style={{
                backgroundColor: 'rgba(20, 20, 27, 0.85)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <span
                className="font-chinese text-sm"
                style={{ color: 'var(--text-secondary)' }}
              >
                枪内子弹
              </span>
              <ShellIndicator
                shells={shells}
                currentIndex={currentShellIndex}
                showUnknown
              />
            </div>

            {/* Shotgun area */}
            <div className="relative flex items-center justify-center">
              {/* Shotgun image */}
              <motion.img
                src={
                  shootingAnim === 'self'
                    ? '/shotgun-aim-self.png'
                    : shootingAnim === 'dealer'
                      ? '/shotgun-aim-opponent.png'
                      : '/shotgun-idle.png'
                }
                alt="霰弹枪"
                className="w-[min(400px,55vw)] sm:w-[min(500px,45vw)] object-contain"
                draggable={false}
                animate={
                  shootingAnim
                    ? { y: -15, scale: 1.05 }
                    : { y: [0, 2, 0] }
                }
                transition={
                  shootingAnim
                    ? { duration: 0.3 }
                    : { duration: 3, repeat: Infinity, ease: 'easeInOut' }
                }
              />

              {/* Muzzle flash overlay */}
              <AnimatePresence>
                {muzzleFlash && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.2 }}
                    transition={{ duration: 0.1 }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100px] h-[100px] rounded-full pointer-events-none"
                    style={{
                      background:
                        'radial-gradient(circle, rgba(255,200,50,0.9) 0%, rgba(255,100,0,0.5) 30%, transparent 70%)',
                    }}
                  />
                )}
              </AnimatePresence>

              {/* Shell eject animation */}
              <AnimatePresence>
                {shellEjectAnim && (
                  <motion.div
                    initial={{ x: 20, y: -10, opacity: 1, rotate: 0 }}
                    animate={{ x: 100, y: 60, opacity: 0, rotate: 720 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="absolute top-0 right-0 w-4 h-4 rounded-full"
                    style={{
                      backgroundColor:
                        ejectedShellType === 'live'
                          ? 'var(--accent-red)'
                          : 'var(--accent-blue-dim)',
                      boxShadow:
                        ejectedShellType === 'live'
                          ? '0 0 8px rgba(220, 38, 38, 0.6)'
                          : '0 0 4px rgba(59, 130, 246, 0.3)',
                    }}
                  />
                )}
              </AnimatePresence>
            </div>

            {/* Revealed shell indicator */}
            <AnimatePresence>
              {revealedShellIndex !== null && itemEffectAnim === 'magnifier' && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="flex items-center gap-3 px-6 py-3 rounded-xl border-2"
                  style={{
                    borderColor:
                      shells[revealedShellIndex]?.type === 'live'
                        ? 'var(--accent-red)'
                        : 'var(--accent-blue)',
                    backgroundColor: 'rgba(20, 20, 27, 0.95)',
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-full"
                    style={{
                      backgroundColor:
                        shells[revealedShellIndex]?.type === 'live'
                          ? 'var(--accent-red)'
                          : 'var(--accent-blue-dim)',
                      boxShadow:
                        shells[revealedShellIndex]?.type === 'live'
                          ? '0 0 16px rgba(220, 38, 38, 0.8)'
                          : '0 0 10px rgba(59, 130, 246, 0.5)',
                    }}
                  />
                  <span
                    className="font-chinese text-lg font-bold"
                    style={{
                      color:
                        shells[revealedShellIndex]?.type === 'live'
                          ? 'var(--accent-red)'
                          : 'var(--accent-blue)',
                    }}
                  >
                    {shells[revealedShellIndex]?.type === 'live' ? '实弹' : '空包弹'}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Item effect animation */}
            <AnimatePresence>
              {itemEffectAnim && itemEffectAnim !== 'magnifier' && (
                <motion.div
                  initial={{ scale: 0, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0, opacity: 0, y: -20 }}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl"
                  style={{
                    backgroundColor: 'rgba(212, 165, 32, 0.2)',
                    border: '1px solid var(--accent-gold)',
                  }}
                >
                  <Sparkles className="w-5 h-5" style={{ color: 'var(--accent-gold)' }} />
                  <span
                    className="font-chinese text-sm font-medium"
                    style={{ color: 'var(--accent-gold)' }}
                  >
                    {itemEffectAnim === 'cigarette' && '香烟生效'}
                    {itemEffectAnim === 'handsaw' && '手锯已装备'}
                    {itemEffectAnim === 'handcuffs' && '手铐已使用'}
                    {itemEffectAnim === 'beer' && '啤酒生效'}
                    {itemEffectAnim === 'adrenaline' && '肾上腺素生效'}
                    {itemEffectAnim === 'medicine' && '药品生效'}
                    {itemEffectAnim === 'inverter' && '逆变器生效'}
                    {itemEffectAnim === 'phone' && '手机通话中...'}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ─── Player Section ─── */}
          <div className="w-full max-w-4xl flex flex-col items-center gap-3">
            {/* Player HP */}
            <HealthBar current={playerHP} max={playerMaxHP} label="你的生命" />

            {/* Player items */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {playerItems.length === 0 && (
                <span
                  className="font-chinese text-xs"
                  style={{ color: 'var(--text-dim)' }}
                >
                  没有道具
                </span>
              )}
              {playerItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onClick={handleUseItem}
                  disabled={!actionsEnabled}
                  size="md"
                />
              ))}
            </div>

            {/* ─── Action Buttons ─── */}
            <div className="flex items-center gap-3 sm:gap-6 w-full max-w-[600px] justify-center pb-2">
              {/* Shoot self button */}
              <motion.button
                whileHover={
                  actionsEnabled ? { scale: 1.03, y: -2 } : {}
                }
                whileTap={actionsEnabled ? { scale: 0.98 } : {}}
                onClick={handleShootSelf}
                disabled={!actionsEnabled}
                className="flex-1 max-w-[280px] h-[64px] sm:h-[72px] rounded-lg font-chinese font-bold flex flex-col items-center justify-center gap-0.5 transition-all"
                style={{
                  fontSize: '18px',
                  color: 'var(--text-primary)',
                  border: `2px solid ${actionsEnabled ? 'var(--accent-blue-dim)' : 'var(--bg-elevated)'}`,
                  background: actionsEnabled
                    ? 'linear-gradient(180deg, rgba(30,30,40,0.9) 0%, rgba(10,10,15,0.95) 100%)'
                    : 'rgba(20, 20, 27, 0.5)',
                  opacity: actionsEnabled ? 1 : 0.4,
                  cursor: actionsEnabled ? 'pointer' : 'not-allowed',
                  boxShadow: actionsEnabled
                    ? '0 4px 16px rgba(0,0,0,0.4), 0 0 20px rgba(59, 130, 246, 0.1)'
                    : 'none',
                }}
              >
                <span className="flex items-center gap-2">
                  <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
                  射向自己
                </span>
                <span
                  className="font-chinese text-xs"
                  style={{ color: 'var(--accent-blue)', fontSize: '11px' }}
                >
                  空包弹 = 额外回合
                </span>
              </motion.button>

              {/* Shoot dealer button */}
              <motion.button
                whileHover={
                  actionsEnabled ? { scale: 1.03, y: -2 } : {}
                }
                whileTap={actionsEnabled ? { scale: 0.98 } : {}}
                onClick={handleShootDealer}
                disabled={!actionsEnabled}
                className="flex-1 max-w-[280px] h-[64px] sm:h-[72px] rounded-lg font-chinese font-bold flex flex-col items-center justify-center gap-0.5 transition-all"
                style={{
                  fontSize: '18px',
                  color: 'var(--text-primary)',
                  border: `2px solid ${actionsEnabled ? 'var(--accent-red)' : 'var(--bg-elevated)'}`,
                  background: actionsEnabled
                    ? 'linear-gradient(180deg, rgba(60,20,20,0.9) 0%, rgba(30,10,10,0.95) 100%)'
                    : 'rgba(20, 20, 27, 0.5)',
                  opacity: actionsEnabled ? 1 : 0.4,
                  cursor: actionsEnabled ? 'pointer' : 'not-allowed',
                  boxShadow: actionsEnabled
                    ? '0 4px 16px rgba(0,0,0,0.4), 0 0 20px rgba(220, 38, 38, 0.15)'
                    : 'none',
                }}
              >
                <span className="flex items-center gap-2">
                  <Crosshair className="w-4 h-4 sm:w-5 sm:h-5" />
                  射向对手
                </span>
                <span
                  className="font-chinese text-xs"
                  style={{ color: 'var(--accent-red-glow)', fontSize: '11px' }}
                >
                  实弹 = 造成伤害
                </span>
              </motion.button>
            </div>
          </div>
        </div>
      </div>
      </motion.div>

      {/* ═══ Overlays ═══ */}

      {/* Round announcement */}
      <AnimatePresence>
        {roundAnnounce && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.2, opacity: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
              className="flex flex-col items-center gap-4 px-12 py-8 rounded-xl border-2"
              style={{
                borderColor: 'var(--accent-gold)',
                backgroundColor: 'rgba(10, 10, 15, 0.95)',
                boxShadow: '0 0 40px rgba(212, 165, 32, 0.3)',
              }}
            >
              <span
                className="font-chinese text-3xl sm:text-5xl font-black"
                style={{
                  color: 'var(--accent-gold)',
                  textShadow: '0 0 20px rgba(212, 165, 32, 0.5)',
                }}
              >
                第 {currentRound} 回合
              </span>
              <span
                className="font-chinese text-lg"
                style={{ color: 'var(--text-secondary)' }}
              >
                {roundLabel.text}
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Guillotine warning */}
      <AnimatePresence>
        {showGuillotineWarning && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-[150] flex items-center justify-center pointer-events-none"
          >
            <div
              className="flex items-center gap-4 px-8 py-4 rounded-xl border-2"
              style={{
                borderColor: 'var(--accent-red)',
                backgroundColor: 'rgba(139, 26, 26, 0.9)',
                boxShadow: '0 0 40px rgba(220, 38, 38, 0.5)',
              }}
            >
              <AlertTriangle className="w-8 h-8" style={{ color: 'var(--accent-gold)' }} />
              <div className="flex flex-col">
                <span
                  className="font-chinese text-xl font-bold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  闸刀已触发！
                </span>
                <span
                  className="font-chinese text-sm"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  恢复类道具失效，下次受伤即死
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Blood flash overlay */}
      <AnimatePresence>
        {bloodFlash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="fixed inset-0 z-[120] pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(139, 26, 26, 0.5) 0%, transparent 70%)',
            }}
          />
        )}
      </AnimatePresence>

      {/* Damage floating text */}
      <AnimatePresence>
        {damageFloatingText && (
          <motion.div
            initial={{
              opacity: 1,
              y: 0,
              x: '-50%',
              scale: 1,
            }}
            animate={{
              opacity: 0,
              y: -80,
              scale: 1.5,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="fixed z-[130] pointer-events-none font-pixel text-4xl font-bold"
            style={{
              left: damageFloatingText.target === 'player' ? '50%' : '50%',
              bottom: damageFloatingText.target === 'player' ? '20%' : '60%',
              color:
                damageFloatingText.text.startsWith('+')
                  ? 'var(--hp-full)'
                  : 'var(--accent-red)',
              textShadow:
                damageFloatingText.text.startsWith('+')
                  ? '0 0 10px rgba(16, 185, 129, 0.8)'
                  : '0 0 10px rgba(220, 38, 38, 0.8)',
            }}
          >
            {damageFloatingText.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings panel */}
      <AnimatePresence>
        {settingsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[140] flex items-center justify-center"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
            onClick={() => setSettingsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="flex flex-col gap-4 p-6 rounded-xl w-[320px]"
              style={{
                backgroundColor: 'var(--bg-dark)',
                border: '1px solid var(--bg-elevated)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              }}
            >
              <h3
                className="font-chinese text-xl font-bold text-center"
                style={{ color: 'var(--text-primary)' }}
              >
                游戏设置
              </h3>

              <button
                onClick={() => setSettingsOpen(false)}
                className="w-full py-2 rounded-lg font-chinese text-sm font-medium transition-all hover:brightness-110"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--bg-surface)',
                }}
              >
                继续游戏
              </button>

              <button
                onClick={handleQuit}
                className="w-full py-2 rounded-lg font-chinese text-sm font-medium transition-all hover:brightness-110"
                style={{
                  backgroundColor: 'rgba(220, 38, 38, 0.2)',
                  color: 'var(--accent-red)',
                  border: '1px solid var(--accent-red)',
                }}
              >
                返回主菜单
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast messages */}
      <MessageToast
        messages={toasts}
        onDismiss={dismissToast}
        autoDismiss
        dismissDelay={2500}
      />

      {/* Phase indicator (mobile only - shown at bottom) */}
      <div
        className="fixed bottom-2 left-1/2 -translate-x-1/2 z-50 sm:hidden"
      >
        <span
          className="font-pixel text-xs px-3 py-1 rounded-full"
          style={{
            color: 'var(--text-dim)',
            backgroundColor: 'rgba(10, 10, 15, 0.8)',
          }}
        >
          {phase === 'ROUND_START' && '回合开始'}
          {phase === 'PLAYER_TURN' && '你的回合'}
          {phase === 'DEALER_TURN' && (dealerThinking ? '思考中...' : '行动中')}
          {phase === 'ANIMATING' && '...'}
          {phase === 'GAME_OVER' && '游戏结束'}
        </span>
      </div>

      {/* Cigarette smoke effect (item use) */}
      <AnimatePresence>
        {itemEffectAnim === 'cigarette' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.3, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
            className="fixed bottom-[15%] left-1/2 -translate-x-1/2 z-[90] pointer-events-none"
          >
            <Cigarette className="w-12 h-12" style={{ color: 'var(--smoke-gray)' }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
