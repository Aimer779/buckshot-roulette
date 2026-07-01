import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import {
  loadShells,
  distributeItems,
  dealerDecision,
  checkGameOver,
} from '@/lib/gameEngine';
import { countShells, getReloadReason, getRemainingShells } from '@/lib/shellFlow';
import { resolveShotOutcome, type ShotOutcome } from '@/lib/shotResolution';
import { playSFX, playBGM } from '@/lib/sound';
import GameLogPanel from '@/components/GameLogPanel';
import GameplayHud from '@/components/gameplay/GameplayHud';
import DealerArea from '@/components/gameplay/DealerArea';
import ShotgunStage from '@/components/gameplay/ShotgunStage';
import PlayerArea from '@/components/gameplay/PlayerArea';
import GameplayOverlays from '@/components/gameplay/GameplayOverlays';
import {
  useGameplayEffects,
  ITEM_EFFECT_DURATION,
} from '@/hooks/useGameplayEffects';
import { useShootSequence } from '@/hooks/useShootSequence';
import type { Item } from '@/store/gameStore';

// ─── Helpers ─────────────────────────────────────────────

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

  // ── Centralized UI effects (toasts, flashes, shell eject, item badges) ──
  const {
    toasts,
    pushToast,
    dismissToast,
    bloodFlash,
    triggerBloodFlash,
    shakeScreen,
    triggerShake,
    muzzleFlash,
    triggerMuzzleFlash,
    damageFloatingText,
    showDamageText,
    itemEffectAnim,
    showItemEffect,
    revealedShellIndex,
    showRevealedShell,
    shellEjectAnim,
    ejectedShellType,
    showShellEject,
  } = useGameplayEffects();

  // ── Local UI state (lifecycle / turn-driven, not short animations) ──
  const [roundAnnounce, setRoundAnnounce] = useState(false);
  const [dealerThinking, setDealerThinking] = useState(false);
  const [showGuillotineWarning, setShowGuillotineWarning] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const initializedRoundRef = useRef<number | null>(null);
  const pendingRoundEndRef = useRef<'won' | 'lost' | null>(null);

  const {
    isAnimatingRef,
    isAnimating,
    shootingAnim,
    shoot,
  } = useShootSequence({
    setPhase,
    triggerShake,
    triggerMuzzleFlash,
    showShellEject,
  });

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

      const { live: liveC, blank: blankC } = countShells(newShells);
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
      const { live: liveC, blank: blankC } = countShells(newShells);
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
    const reason = getReloadReason(s.shells, s.currentShellIndex);
    if (!reason) return { reloaded: false, reason: null };

    reloadShells(reason);
    return { reloaded: true, reason };
  }, [reloadShells]);

  const applyShotOutcome = useCallback(
    (outcome: ShotOutcome) => {
      if (outcome.hit && outcome.damageTarget) {
        if (outcome.damageTarget === 'player') {
          triggerBloodFlash();
        }
        damage(outcome.damageTarget, outcome.damage);
        playSFX('damage');
        showDamageText(`-${outcome.damage}`, outcome.damageTarget);
      }

      if (outcome.sawConsumed) {
        setSawActive(false);
      }
    },
    [damage, setSawActive, showDamageText, triggerBloodFlash]
  );

  // ── Handle shoot self ──
  const handleShootSelf = useCallback(async () => {
    if (phase !== 'PLAYER_TURN' || isAnimatingRef.current) return;

    const shellType = await shoot('self');
    if (!shellType) return;

    const outcome = resolveShotOutcome({
      actor: 'player',
      target: 'player',
      shellType,
      sawActive: useGameStore.getState().sawActive,
    });
    applyShotOutcome(outcome);

    if (outcome.hit) {
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
      return;
    }

    setTimeout(() => {
      reloadIfEmptyOrAllBlank();
      setPhase('PLAYER_TURN');
    }, 600);
  }, [
    phase,
    isAnimatingRef,
    shoot,
    applyShotOutcome,
    reloadIfEmptyOrAllBlank,
    setPhase,
  ]);

  // ── Handle shoot dealer ──
  const handleShootDealer = useCallback(async () => {
    if (phase !== 'PLAYER_TURN' || isAnimatingRef.current) return;

    const shellType = await shoot('dealer');
    if (!shellType) return;

    applyShotOutcome(resolveShotOutcome({
      actor: 'player',
      target: 'dealer',
      shellType,
      sawActive: useGameStore.getState().sawActive,
    }));

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
  }, [
    phase,
    isAnimatingRef,
    shoot,
    applyShotOutcome,
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

      const remainingShells = getRemainingShells(s.shells, s.currentShellIndex);
      const { live: liveCount, blank: blankCount } = countShells(remainingShells);

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
  const executeDealerShoot = useCallback(async () => {
    const s = useGameStore.getState();
    const remainingShells = getRemainingShells(s.shells, s.currentShellIndex);

    // Defensive: skip an empty or all-blank magazine before the dealer acts
    if (reloadIfEmptyOrAllBlank().reloaded) {
      setTimeout(() => {
        setPhase('PLAYER_TURN');
        pushToast('你的回合', 'info');
      }, 600);
      return;
    }

    const { live: liveCount, blank: blankCount } = countShells(remainingShells);

    // Simple decision: if more blanks, shoot self; else shoot player
    const blankRatio = blankCount / (liveCount + blankCount);
    const shootSelf = blankRatio > 0.5;

    const shellType = await shoot(shootSelf ? 'self' : 'dealer');
    if (!shellType) return;

    const outcome = resolveShotOutcome({
      actor: 'dealer',
      target: shootSelf ? 'dealer' : 'player',
      shellType,
      sawActive: useGameStore.getState().sawActive,
    });
    applyShotOutcome(outcome);

    if (outcome.keepsTurn) {
      setTimeout(() => {
        const ns = useGameStore.getState();
        if (ns.currentShellIndex >= ns.shells.length) {
          reloadIfEmptyOrAllBlank();
          setTimeout(() => {
            setPhase('PLAYER_TURN');
            pushToast('你的回合', 'info');
          }, 600);
        } else if (reloadIfEmptyOrAllBlank().reloaded) {
          setTimeout(() => {
            setPhase('PLAYER_TURN');
            pushToast('你的回合', 'info');
          }, 600);
        } else {
          setPhase('DEALER_TURN');
        }
      }, 1000);
      return;
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
  }, [
    shoot,
    applyShotOutcome,
    pushToast,
    reloadIfEmptyOrAllBlank,
    setPhase,
  ]);

  // ── Handle player item use ──
  const handleUseItem = useCallback(
    (item: Item) => {
      if (phase !== 'PLAYER_TURN' || isAnimatingRef.current) return;

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
            showItemEffect('cigarette');
          }
          break;
        }

        // ─── 手锯: double damage ───
        case 'handsaw':
          if (!sawActive) {
            setSawActive(true);
            removeItem('player', item.id);
            playSFX('saw');
            addLog('手锯已装备，下一发伤害翻倍', 'item');
            showItemEffect('handsaw');
          }
          break;

        // ─── 手铐: skip dealer turn ───
        case 'handcuffs':
          setSkipDealerTurn(true);
          removeItem('player', item.id);
          playSFX('metal-clank');
          addLog('手铐已使用，庄家下回合被跳过', 'item');
          showItemEffect('handcuffs');
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
            showItemEffect('beer');
            showShellEject(st, ITEM_EFFECT_DURATION);
            setTimeout(() => {
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
            addLog(`当前子弹: ${shell.type === 'live' ? '实弹' : '空包弹'}`, 'item');
            removeItem('player', item.id);
            playSFX('item-use');
            showRevealedShell(s.currentShellIndex);
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
            addLog('偷取了庄家的道具', 'item');
            showItemEffect('adrenaline');
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
          showItemEffect('medicine');

          if (roll < 0.5) {
            heal('player', 2);
            addLog('过期药品生效，恢复 2 点生命', 'heal');
          } else {
            damage('player', 1);
            triggerBloodFlash();
            showDamageText('-1', 'player');
            addLog('过期药品失效，失去 1 点生命', 'damage');
          }
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
            addLog(`逆变器翻转了子弹类型`, 'item');
            showItemEffect('inverter');
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
          showItemEffect('phone');

          if (futureIndices.length > 0) {
            const ri = futureIndices[Math.floor(Math.random() * futureIndices.length)];
            revealShell(ri);
            addLog(`手机揭示了第 ${ri - s.currentShellIndex} 发子弹`, 'item');
          }
          break;
        }

        default:
          break;
      }
    },
    [
      phase,
      isAnimatingRef,
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
      showItemEffect,
      showShellEject,
      showRevealedShell,
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
  const actionsEnabled = isPlayerTurn && !isAnimating && !roundAnnounce;
  const roundLabel = ROUND_LABELS[currentRound] || ROUND_LABELS[3];

  // ─── Render ─────────────────────────────────────────────

  return (
    <div
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
        <GameplayHud
          phase={phase}
          dealerThinking={dealerThinking}
          currentRound={currentRound}
          maxRounds={maxRounds}
          roundLabel={roundLabel}
          sawActive={sawActive}
          skipDealerTurn={skipDealerTurn}
          onToggleSettings={() => setSettingsOpen((prev) => !prev)}
        />

        {/* ═══ Game Log + Main Game Area ═══ */}
        <div className="relative flex-1 flex overflow-hidden">
          <GameLogPanel />

          {/* ═══ Main Game Area ═══ */}
          <div className="flex-1 flex flex-col items-center justify-between px-4 py-2 sm:py-4 relative overflow-y-auto">
            {/* ─── Dealer Section ─── */}
            <DealerArea
              dealerHP={dealerHP}
              dealerMaxHP={dealerMaxHP}
              dealerItems={dealerItems}
              phase={phase}
            />

            {/* ─── Central Game Area ─── */}
            <ShotgunStage
              shells={shells}
              currentShellIndex={currentShellIndex}
              shootingAnim={shootingAnim}
              muzzleFlash={muzzleFlash}
              shellEjectAnim={shellEjectAnim}
              ejectedShellType={ejectedShellType}
              revealedShellIndex={revealedShellIndex}
              itemEffectAnim={itemEffectAnim}
            />

            {/* ─── Player Section ─── */}
            <PlayerArea
              playerHP={playerHP}
              playerMaxHP={playerMaxHP}
              playerItems={playerItems}
              actionsEnabled={actionsEnabled}
              onUseItem={handleUseItem}
              onShootSelf={handleShootSelf}
              onShootDealer={handleShootDealer}
            />
          </div>
        </div>
      </motion.div>

      {/* ═══ Overlays ═══ */}
      <GameplayOverlays
        roundAnnounce={roundAnnounce}
        currentRound={currentRound}
        roundLabel={roundLabel}
        showGuillotineWarning={showGuillotineWarning}
        bloodFlash={bloodFlash}
        damageFloatingText={damageFloatingText}
        settingsOpen={settingsOpen}
        phase={phase}
        dealerThinking={dealerThinking}
        itemEffectAnim={itemEffectAnim}
        toasts={toasts}
        onDismissToast={dismissToast}
        onCloseSettings={() => setSettingsOpen(false)}
        onQuit={handleQuit}
      />
    </div>
  );
}
