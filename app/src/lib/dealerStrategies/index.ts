export type { DealerContext, DealerDecision, DealerStrategy } from './types';
export { balancedStrategy } from './balancedStrategy';
export { aggressiveStrategy } from './aggressiveStrategy';
export { conservativeStrategy } from './conservativeStrategy';
export {
  resolveDealerTurnDecision,
  type DealerTurnDecision,
} from './resolveDealerTurn';

import { balancedStrategy } from './balancedStrategy';
import { aggressiveStrategy } from './aggressiveStrategy';
import { conservativeStrategy } from './conservativeStrategy';
import type { DealerStrategy } from './types';

export const DEALER_STRATEGIES: DealerStrategy[] = [
  balancedStrategy,
  aggressiveStrategy,
  conservativeStrategy,
];

export const DEFAULT_DEALER_STRATEGY_ID = balancedStrategy.id;

export function getStrategyById(id: string): DealerStrategy {
  return DEALER_STRATEGIES.find((s) => s.id === id) ?? balancedStrategy;
}
