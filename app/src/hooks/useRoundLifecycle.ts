import { useCallback, useEffect, useRef, useState } from 'react';
import type { NavigateFunction } from 'react-router';
import { useGameStore } from '@/store/gameStore';
import { loadShells, distributeItems, checkGameOver } from '@/lib/gameEngine';
import { countShells } from '@/lib/shellFlow';
import { playBGM, playSFX } from '@/lib/sound';
import type { ToastMsg } from '@/hooks/useGameplayEffects';

interface UseRoundLifecycleOptions {
  navigate: NavigateFunction;
  pushToast: (message: string, type?: ToastMsg['type']) => void;
}

/**
 * Round lifecycle: BGM, init/retry/advance, guillotine, game-over detection,
 * and delayed transitions. Owns initializedRoundRef and pendingRoundEndRef so
 * the ROUND_END handshake between detection and transition effects stays intact.
 */
export function useRoundLifecycle({
  navigate,
  pushToast,
}: UseRoundLifecycleOptions) {
  const {
    phase,
    setPhase,
    playerHP,
    dealerHP,
    currentRound,
    maxRounds,
    guillotineTriggered,
    loadShells: storeLoadShells,
    addItem,
    addLog,
    setSawActive,
    setSkipDealerTurn,
    setGuillotineTriggered,
    setWinner,
    nextRound,
    retryRound,
  } = useGameStore();

  const [roundAnnounce, setRoundAnnounce] = useState(false);
  const [showGuillotineWarning, setShowGuillotineWarning] = useState(false);

  const isInitializedRef = useRef(false);
  const initializedRoundRef = useRef<number | null>(null);
  const pendingRoundEndRef = useRef<'won' | 'lost' | null>(null);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const schedule = useCallback((fn: () => void, delay: number) => {
    const id = setTimeout(() => {
      timersRef.current.delete(id);
      fn();
    }, delay);
    timersRef.current.add(id);
    return id;
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
    };
  }, []);

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
      pushToast(
        `第 ${round} 回合开始 · 实弹 ${liveC} 发 | 空包弹 ${blankC} 发`,
        'system'
      );

      setRoundAnnounce(true);

      schedule(() => {
        setRoundAnnounce(false);
        schedule(() => {
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
      schedule,
    ]
  );

  // Gameplay BGM + first round init on mount
  useEffect(() => {
    playBGM('gameplay');
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      initRound(true);
    }
    // Mount-only: initRound is stable enough; re-running would duplicate round setup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guillotine trigger detection
  useEffect(() => {
    if (currentRound === 3 && !guillotineTriggered) {
      if (playerHP <= 2 || dealerHP <= 2) {
        setGuillotineTriggered(true);
        playSFX('guillotine-drop');
        setShowGuillotineWarning(true);
        pushToast('闸刀已触发！恢复类道具失效！', 'damage');
        addLog('闸刀已触发！恢复类道具失效！', 'damage');
        schedule(() => setShowGuillotineWarning(false), 4000);
      }
    }
  }, [
    playerHP,
    dealerHP,
    currentRound,
    guillotineTriggered,
    setGuillotineTriggered,
    pushToast,
    addLog,
    schedule,
  ]);

  // Game-over / round-end detection
  useEffect(() => {
    if (phase === 'GAME_OVER' || phase === 'ROUND_END' || phase === 'ROUND_START') {
      return;
    }
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

  // Delayed navigation to game over (cleaned up on unmount / quit)
  useEffect(() => {
    if (phase !== 'GAME_OVER') return;
    const timer = setTimeout(() => {
      navigate('/gameover');
    }, 2500);
    return () => clearTimeout(timer);
  }, [phase, navigate]);

  // Delayed nextRound / retryRound after ROUND_END
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

  // Init round after nextRound() advances state
  useEffect(() => {
    if (!isInitializedRef.current || phase !== 'ROUND_START') return;
    if (initializedRoundRef.current === currentRound) return;
    initRound(false);
  }, [phase, currentRound, initRound]);

  return {
    roundAnnounce,
    showGuillotineWarning,
  };
}