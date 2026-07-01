import { useCallback, useEffect, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { dealerDecision } from '@/lib/gameEngine';
import { countShells, getRemainingShells } from '@/lib/shellFlow';
import { resolveShotOutcome, type ShotOutcome } from '@/lib/shotResolution';
import type { GamePhase, Item } from '@/store/gameStore';
import type { ToastMsg } from '@/hooks/useGameplayEffects';
import type { ShootAnimationTarget } from '@/hooks/useShootSequence';

interface UseDealerTurnOptions {
  phase: GamePhase;
  shells: ReturnType<typeof useGameStore.getState>['shells'];
  currentShellIndex: number;
  setPhase: (phase: GamePhase) => void;
  setSkipDealerTurn: (skip: boolean) => void;
  addLog: (message: string, type: 'info' | 'damage' | 'heal' | 'item' | 'system') => void;
  pushToast: (message: string, type?: ToastMsg['type']) => void;
  reloadIfEmptyOrAllBlank: () => {
    reloaded: boolean;
    reason: 'empty' | 'no-live' | null;
  };
  applyDealerItem: (item: Item) => void;
  shoot: (target: ShootAnimationTarget) => Promise<'live' | 'blank' | null>;
  applyShotOutcome: (outcome: ShotOutcome) => void;
}

/**
 * Dealer turn: handcuff skip, reload gate, thinking delay, item use, and shooting.
 * Blank self-shot extra turn is preserved by setting phase back to DEALER_TURN,
 * which retriggers this effect.
 */
export function useDealerTurn({
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
}: UseDealerTurnOptions) {
  const [dealerThinking, setDealerThinking] = useState(false);

  const executeDealerShoot = useCallback(async () => {
    const s = useGameStore.getState();
    const remainingShells = getRemainingShells(s.shells, s.currentShellIndex);

    if (reloadIfEmptyOrAllBlank().reloaded) {
      setTimeout(() => {
        setPhase('PLAYER_TURN');
        pushToast('你的回合', 'info');
      }, 600);
      return;
    }

    const { live: liveCount, blank: blankCount } = countShells(remainingShells);

    // Re-decides target by shell ratio (not dealerDecision); preserved intentionally.
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

  useEffect(() => {
    if (phase !== 'DEALER_TURN') return;

    const timer = setTimeout(() => {
      const s = useGameStore.getState();
      if (s.dealerHP <= 0 || s.playerHP <= 0) return;

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

      setTimeout(() => {
        setDealerThinking(false);

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
    executeDealerShoot,
  ]);

  return { dealerThinking };
}