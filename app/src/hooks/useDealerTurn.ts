import { useCallback, useEffect, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { getStrategyById, resolveDealerTurnDecision, type DealerContext } from '@/lib/dealerStrategies';
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

function buildDealerContext(s: ReturnType<typeof useGameStore.getState>): DealerContext {
  const remaining = getRemainingShells(s.shells, s.currentShellIndex);
  const counts = countShells(remaining);
  return {
    dealerHP: s.dealerHP,
    playerHP: s.playerHP,
    dealerMaxHP: s.dealerMaxHP,
    liveCount: counts.live,
    blankCount: counts.blank,
    shellsRemaining: remaining.length,
    dealerItems: s.dealerItems,
    dealerSawActive: s.dealerSawActive,
    guillotineTriggered: s.guillotineTriggered,
  };
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

  const executeDealerShoot = useCallback(async (target: 'self' | 'dealer') => {
    if (reloadIfEmptyOrAllBlank().reloaded) {
      setTimeout(() => {
        setPhase('PLAYER_TURN');
        pushToast('你的回合', 'info');
      }, 600);
      return;
    }

    const shootTarget: ShootAnimationTarget = target === 'self' ? 'self' : 'dealer';
    const outcomeTarget = target === 'self' ? 'dealer' : 'player';

    const shellType = await shoot(shootTarget);
    if (!shellType) return;

    const outcome = resolveShotOutcome({
      actor: 'dealer',
      target: outcomeTarget,
      shellType,
      actorSawActive: useGameStore.getState().dealerSawActive,
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

      const strategy = getStrategyById(s.dealerStrategyId);
      const ctx = buildDealerContext(s);
      const turnDecision = resolveDealerTurnDecision(strategy, ctx);

      setTimeout(() => {
        setDealerThinking(false);

        if (turnDecision.action === 'use-item') {
          const item = s.dealerItems.find((i) => i.id === turnDecision.itemId);
          if (item) {
            applyDealerItem(item);
            setTimeout(() => executeDealerShoot(turnDecision.shootTarget), 1200);
          } else {
            executeDealerShoot(turnDecision.shootTarget);
          }
        } else {
          executeDealerShoot(turnDecision.target);
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
