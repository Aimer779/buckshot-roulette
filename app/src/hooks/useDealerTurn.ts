import { useCallback, useEffect, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import {
  getStrategyById,
  resolveDealerTurnDecision,
  JEV_STRATEGY_ID,
  type DealerContext,
  type DealerTurnDecision,
  type JevHud,
} from '@/lib/dealerStrategies';
import { fetchJevDealerTurn, localJevFallback } from '@/lib/dealerStrategies/jev/client';
import { ACTION_LABELS, type JevDealerState } from '@/lib/dealerStrategies/jev/types';
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
    playerItems: s.playerItems,
    playerMaxHP: s.playerMaxHP,
    skipPlayerTurn: s.skipPlayerTurn,
    currentRound: s.currentRound,
  };
}

function buildJevDealerState(s: ReturnType<typeof useGameStore.getState>): JevDealerState {
  const ctx = buildDealerContext(s);
  return {
    dealerHP: ctx.dealerHP,
    playerHP: ctx.playerHP,
    dealerMaxHP: ctx.dealerMaxHP,
    playerMaxHP: s.playerMaxHP,
    liveCount: ctx.liveCount,
    blankCount: ctx.blankCount,
    shellsRemaining: ctx.shellsRemaining,
    dealerItems: s.dealerItems.map((item) => ({ id: item.id, type: item.type })),
    playerItems: s.playerItems.map((item) => ({ id: item.id, type: item.type })),
    dealerSawActive: ctx.dealerSawActive,
    guillotineTriggered: ctx.guillotineTriggered,
    skipPlayerTurn: s.skipPlayerTurn,
    currentRound: s.currentRound,
    confidenceMin: s.jevConfidenceMin,
  };
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}

function abortAfter(signal: AbortSignal, ms: number): AbortSignal {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  const onAbort = () => {
    clearTimeout(timer);
    ac.abort();
  };
  if (signal.aborted) onAbort();
  else signal.addEventListener('abort', onAbort, { once: true });
  return ac.signal;
}

function logJevHud(
  hud: JevHud,
  addLog: (message: string, type: 'info' | 'damage' | 'heal' | 'item' | 'system') => void
) {
  if (hud.fallback) {
    const why = hud.reason === 'no-key' ? '未配置密钥' : hud.reason === 'timeout' ? '超时' : hud.reason === 'low-confidence' ? '置信不足' : '不可用';
    addLog(`Jev ${why}，回退均衡型`, 'system');
    return;
  }
  const label = ACTION_LABELS[hud.action] ?? hud.action;
  addLog(
    `Jev 选择 ${label} · 置信 ${hud.confidence.toFixed(2)} · ${hud.latencyMs}ms`,
    'system'
  );
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
  const [jevHud, setJevHud] = useState<JevHud | null>(null);

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

    const abort = new AbortController();
    const timer = setTimeout(() => {
      void (async () => {
        const s = useGameStore.getState();
        if (abort.signal.aborted || s.dealerHP <= 0 || s.playerHP <= 0) return;

        if (s.skipDealerTurn) {
          setSkipDealerTurn(false);
          addLog('庄家被手铐束缚，跳过回合', 'info');
          setTimeout(() => {
            if (abort.signal.aborted) return;
            reloadIfEmptyOrAllBlank();
            setPhase('PLAYER_TURN');
            pushToast('你的回合', 'info');
          }, 1000);
          return;
        }

        if (reloadIfEmptyOrAllBlank().reloaded) {
          setTimeout(() => {
            if (abort.signal.aborted) return;
            setPhase('PLAYER_TURN');
            pushToast('你的回合', 'info');
          }, 600);
          return;
        }

        setDealerThinking(true);
        setJevHud(null);
        addLog('庄家思考中...', 'info');

        const strategy = getStrategyById(s.dealerStrategyId);
        const ctx = buildDealerContext(s);
        const thinkMs = 2000 + Math.random() * 1000;
        let turnDecision: DealerTurnDecision;

        if (strategy.id === JEV_STRATEGY_ID) {
          const jevState = buildJevDealerState(s);
          const jevSignal = abortAfter(abort.signal, 3000);
          const [jevResult] = await Promise.all([
            fetchJevDealerTurn(jevState, jevSignal).catch((err: unknown) => {
              if (abort.signal.aborted) return localJevFallback(jevState, 'aborted');
              const name = err instanceof Error ? err.name : '';
              const reason = name === 'AbortError' || name === 'TimeoutError' ? 'timeout' : 'network';
              return localJevFallback(jevState, reason);
            }),
            delay(thinkMs, abort.signal),
          ]);
          if (abort.signal.aborted) return;
          setJevHud(jevResult.hud);
          logJevHud(jevResult.hud, addLog);
          turnDecision = jevResult.turn;
        } else {
          turnDecision = resolveDealerTurnDecision(strategy, ctx);
          await delay(thinkMs, abort.signal);
          if (abort.signal.aborted) return;
        }

        setDealerThinking(false);

        if (turnDecision.action === 'use-item') {
          const item = s.dealerItems.find((i) => i.id === turnDecision.itemId);
          if (item) {
            applyDealerItem(item);
            setTimeout(() => {
              if (abort.signal.aborted) return;
              executeDealerShoot(turnDecision.shootTarget);
            }, 1200);
          } else {
            executeDealerShoot(turnDecision.shootTarget);
          }
        } else {
          executeDealerShoot(turnDecision.target);
        }
      })();
    }, 600);

    return () => {
      abort.abort();
      clearTimeout(timer);
    };
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

  return { dealerThinking, jevHud };
}
