import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { loadShells, dealerDecision } from '@/lib/gameEngine';
import { countShells, getReloadReason, getRemainingShells } from '@/lib/shellFlow';
import { resolveShotOutcome, type ShotOutcome } from '@/lib/shotResolution';
import { playSFX } from '@/lib/sound';
import GameLogPanel from '@/components/GameLogPanel';
import GameplayHud from '@/components/gameplay/GameplayHud';
import DealerArea from '@/components/gameplay/DealerArea';
import ShotgunStage from '@/components/gameplay/ShotgunStage';
import PlayerArea from '@/components/gameplay/PlayerArea';
import GameplayOverlays from '@/components/gameplay/GameplayOverlays';
import { useGameplayEffects } from '@/hooks/useGameplayEffects';
import { useShootSequence } from '@/hooks/useShootSequence';
import { useRoundLifecycle } from '@/hooks/useRoundLifecycle';
import { usePlayerItems } from '@/hooks/usePlayerItems';

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
    skipDealerTurn,
    damage,
    setSawActive,
    setSkipDealerTurn,
    addLog,
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

  const { roundAnnounce, showGuillotineWarning } = useRoundLifecycle({
    navigate,
    pushToast,
  });

  // ── Local UI state (turn-driven, not short animations) ──
  const [dealerThinking, setDealerThinking] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  const { handleUseItem, applyDealerItem } = usePlayerItems({
    phase,
    isAnimatingRef,
    showItemEffect,
    showShellEject,
    showRevealedShell,
    triggerBloodFlash,
    showDamageText,
    reloadIfEmptyOrAllBlank,
  });

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
            applyDealerItem(item);
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
    applyDealerItem,
  ]);

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
