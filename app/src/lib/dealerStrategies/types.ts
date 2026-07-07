import type { Item } from '@/store/gameStore';

/**
 * Information available to all dealer strategies.
 * Strategies may only rely on aggregate shell counts and public state,
 * never on the hidden order of remaining shells.
 */
export interface DealerContext {
  dealerHP: number;
  /** Exposed for future expected-utility strategies; current rule strategies ignore it. */
  playerHP: number;
  dealerMaxHP: number;
  liveCount: number;
  blankCount: number;
  shellsRemaining: number;
  dealerItems: Item[];
  dealerSawActive: boolean;
  guillotineTriggered: boolean;
}

export interface DealerDecision {
  action: 'shoot-self' | 'shoot-player' | 'use-item';
  itemId?: string;
  reasoning: string;
}

export interface DealerStrategy {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  decide(ctx: DealerContext): DealerDecision;
}
