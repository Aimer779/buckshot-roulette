import { useCallback, type MutableRefObject } from 'react';
import { useGameStore, type Item, type GamePhase } from '@/store/gameStore';
import {
  executeItemEffect,
  type ItemActor,
  type ItemEffectContext,
  type ItemEffectResult,
} from '@/lib/itemEffects';
import { playSFX } from '@/lib/sound';
import { ITEM_EFFECT_DURATION } from '@/hooks/useGameplayEffects';

export interface ApplyItemEffectDeps {
  heal: (target: 'player' | 'dealer', amount: number) => void;
  damage: (target: 'player' | 'dealer', amount: number) => void;
  removeItem: (target: 'player' | 'dealer', itemId: string) => void;
  addItem: (target: 'player' | 'dealer', item: Item) => void;
  setSawActive: (active: boolean) => void;
  setSkipDealerTurn: (skip: boolean) => void;
  revealShell: (index: number) => void;
  addLog: (message: string, type: 'info' | 'damage' | 'heal' | 'item' | 'system') => void;
  showItemEffect?: (type: string, duration?: number) => void;
  showShellEject?: (type: 'live' | 'blank', duration?: number) => void;
  showRevealedShell?: (index: number, duration?: number) => void;
  triggerBloodFlash?: () => void;
  showDamageText?: (text: string, target: 'player' | 'dealer') => void;
  reloadIfEmptyOrAllBlank?: () => { reloaded: boolean };
}

export function applyItemEffectResult(
  actor: ItemActor,
  result: ItemEffectResult,
  deps: ApplyItemEffectDeps
) {
  const opponent: 'player' | 'dealer' = actor === 'player' ? 'dealer' : 'player';

  for (const id of result.consumedItemIds) {
    deps.removeItem(actor, id);
  }

  if (result.removedOpponentItemIds) {
    for (const id of result.removedOpponentItemIds) {
      deps.removeItem(opponent, id);
    }
  }

  if (result.addedItems) {
    for (const item of result.addedItems) {
      deps.addItem(actor, item);
    }
  }

  if (result.hpChanges) {
    for (const change of result.hpChanges) {
      if (change.kind === 'heal') {
        deps.heal(change.target, change.amount);
      } else {
        deps.damage(change.target, change.amount);
        if (result.triggerBloodFlashOnDamage) {
          deps.triggerBloodFlash?.();
        }
        if (result.showDamageText) {
          deps.showDamageText?.(
            result.showDamageText.text,
            result.showDamageText.target
          );
        }
      }
    }
  }

  if (result.shellUpdates) {
    useGameStore.setState({ shells: result.shellUpdates });
  }

  if (result.consumeCurrentShell) {
    useGameStore.getState().useCurrentShell();
  }

  if (result.revealedShellIndices) {
    for (const index of result.revealedShellIndices) {
      deps.revealShell(index);
    }
  }

  if (result.sawActive !== undefined) {
    deps.setSawActive(result.sawActive);
  }

  if (result.skipDealerTurn) {
    deps.setSkipDealerTurn(true);
  }

  if (result.log) {
    deps.addLog(result.log.message, result.log.type);
  }

  if (result.sfx) {
    playSFX(result.sfx);
  }

  if (result.uiEffect) {
    deps.showItemEffect?.(result.uiEffect);
  }

  if (result.showRevealedShellAt !== undefined) {
    deps.showRevealedShell?.(result.showRevealedShellAt);
  }

  if (result.scheduleReloadAfterEject && result.ejectedShellType) {
    deps.showShellEject?.(result.ejectedShellType, ITEM_EFFECT_DURATION);
    setTimeout(() => {
      deps.reloadIfEmptyOrAllBlank?.();
    }, ITEM_EFFECT_DURATION);
  }
}

function buildContext(actor: ItemActor, item: Item): ItemEffectContext {
  const s = useGameStore.getState();
  return {
    actor,
    item,
    playerHP: s.playerHP,
    playerMaxHP: s.playerMaxHP,
    dealerHP: s.dealerHP,
    dealerMaxHP: s.dealerMaxHP,
    shells: s.shells,
    currentShellIndex: s.currentShellIndex,
    currentShell: s.getCurrentShell(),
    sawActive: s.sawActive,
    guillotineTriggered: s.guillotineTriggered,
    opponentItems: actor === 'player' ? s.dealerItems : s.playerItems,
  };
}

interface UsePlayerItemsOptions {
  phase: GamePhase;
  isAnimatingRef: MutableRefObject<boolean>;
  showItemEffect: (type: string, duration?: number) => void;
  showShellEject: (type: 'live' | 'blank', duration?: number) => void;
  showRevealedShell: (index: number, duration?: number) => void;
  triggerBloodFlash: () => void;
  showDamageText: (text: string, target: 'player' | 'dealer') => void;
  reloadIfEmptyOrAllBlank: () => { reloaded: boolean };
}

export function usePlayerItems({
  phase,
  isAnimatingRef,
  showItemEffect,
  showShellEject,
  showRevealedShell,
  triggerBloodFlash,
  showDamageText,
  reloadIfEmptyOrAllBlank,
}: UsePlayerItemsOptions) {
  const {
    heal,
    damage,
    removeItem,
    addItem,
    setSawActive,
    setSkipDealerTurn,
    revealShell,
    addLog,
  } = useGameStore();

  const handleUseItem = useCallback(
    (item: Item) => {
      if (phase !== 'PLAYER_TURN' || isAnimatingRef.current) return;

      const result = executeItemEffect(buildContext('player', item));
      if (!result) return;

      applyItemEffectResult('player', result, {
        heal,
        damage,
        removeItem,
        addItem,
        setSawActive,
        setSkipDealerTurn,
        revealShell,
        addLog,
        showItemEffect,
        showShellEject,
        showRevealedShell,
        triggerBloodFlash,
        showDamageText,
        reloadIfEmptyOrAllBlank,
      });
    },
    [
      phase,
      isAnimatingRef,
      heal,
      damage,
      removeItem,
      addItem,
      setSawActive,
      setSkipDealerTurn,
      revealShell,
      addLog,
      showItemEffect,
      showShellEject,
      showRevealedShell,
      triggerBloodFlash,
      showDamageText,
      reloadIfEmptyOrAllBlank,
    ]
  );

  const applyDealerItem = useCallback(
    (item: Item) => {
      // Store-only deps on purpose: dealer items must not trigger player UI badges.
      // executeItemEffect encodes which dealer item types are effective vs noop.
      const result = executeItemEffect(buildContext('dealer', item));
      if (!result) return;
      applyItemEffectResult('dealer', result, {
        heal,
        damage,
        removeItem,
        addItem,
        setSawActive,
        setSkipDealerTurn,
        revealShell,
        addLog,
      });
    },
    [
      heal,
      damage,
      removeItem,
      addItem,
      setSawActive,
      setSkipDealerTurn,
      revealShell,
      addLog,
    ]
  );

  return { handleUseItem, applyDealerItem };
}