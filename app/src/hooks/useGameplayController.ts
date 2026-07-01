import { useCallback, useState } from 'react';
import type { NavigateFunction } from 'react-router';
import { useGameStore } from '@/store/gameStore';
import { loadShells } from '@/lib/gameEngine';
import { countShells, getReloadReason } from '@/lib/shellFlow';
import { resolveShotOutcome, type ShotOutcome } from '@/lib/shotResolution';
import { playSFX } from '@/lib/sound';
import { useGameplayEffects } from '@/hooks/useGameplayEffects';
import { useShootSequence } from '@/hooks/useShootSequence';
import { useRoundLifecycle } from '@/hooks/useRoundLifecycle';
import { usePlayerItems } from '@/hooks/usePlayerItems';
import { useDealerTurn } from '@/hooks/useDealerTurn';

const ROUND_LABELS: Record<number, { text: string; color: string; bg: string }> = {
  1: { text: '教学回合', color: 'var(--accent-blue)', bg: 'rgba(59, 130, 246, 0.2)' },
  2: { text: '道具回合', color: 'var(--accent-amber)', bg: 'rgba(245, 158, 11, 0.2)' },
  3: { text: '最终对决', color: 'var(--accent-red)', bg: 'rgba(220, 38, 38, 0.2)' },
};

export function useGameplayController(navigate: NavigateFunction) {
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

  const { dealerThinking } = useDealerTurn({
    phase,
    shells,
    currentShellIndex,
    setPhase,
    setSkipDealerTurn,
    addLog,
    pushToast,
    reloadIfEmptyOrAllBlank,
    applyDealerItem,
    shoot,
    applyShotOutcome,
  });

  const handleQuit = useCallback(() => {
    setSettingsOpen(false);
    setPhase('TITLE');
    useGameStore.getState().resetGame();
    navigate('/');
  }, [setPhase, navigate]);

  const isPlayerTurn = phase === 'PLAYER_TURN';
  const actionsEnabled = isPlayerTurn && !isAnimating && !roundAnnounce;
  const roundLabel = ROUND_LABELS[currentRound] || ROUND_LABELS[3];

  return {
    state: {
      phase,
      playerHP,
      playerMaxHP,
      dealerHP,
      dealerMaxHP,
      shells,
      currentShellIndex,
      playerItems,
      dealerItems,
      currentRound,
      maxRounds,
      sawActive,
      skipDealerTurn,
      dealerThinking,
      actionsEnabled,
      roundLabel,
    },
    ui: {
      toasts,
      roundAnnounce,
      shootingAnim,
      muzzleFlash,
      bloodFlash,
      shakeScreen,
      shellEjectAnim,
      ejectedShellType,
      showGuillotineWarning,
      itemEffectAnim,
      revealedShellIndex,
      damageFloatingText,
      settingsOpen,
    },
    actions: {
      shootSelf: handleShootSelf,
      shootDealer: handleShootDealer,
      useItem: handleUseItem,
      dismissToast,
      toggleSettings: () => setSettingsOpen((prev) => !prev),
      closeSettings: () => setSettingsOpen(false),
      quit: handleQuit,
    },
  };
}