import type { ItemType } from '@/store/gameStore';
import type { DealerContext } from '../types';
import { buildJevFacts } from './facts';
import { resolveForcedDealerTurn } from './forced';
import { clampJevConfidenceMin, JEV_CONFIDENCE_THRESHOLD } from './policy';

const CHAMBER_CHANGING: ReadonlySet<string> = new Set(['magnifier', 'beer', 'inverter']);

/**
 * After a chamber-changing item, recompute who to shoot.
 * `target: 'dealer'` means shoot the player (see useDealerTurn mapping).
 */
export function retargetAfterItem(
  itemType: ItemType,
  previousTarget: 'self' | 'dealer',
  ctxAfter: DealerContext,
  shootT: number
): 'self' | 'dealer' {
  if (!CHAMBER_CHANGING.has(itemType)) return previousTarget;

  const forced = resolveForcedDealerTurn(ctxAfter);
  if (forced) {
    if (forced.turn.action === 'shoot') return forced.turn.target;
    return forced.turn.shootTarget;
  }

  if (itemType === 'inverter') {
    return previousTarget === 'self' ? 'dealer' : 'self';
  }

  const facts = buildJevFacts(ctxAfter);
  const threshold = clampJevConfidenceMin(shootT ?? JEV_CONFIDENCE_THRESHOLD);
  return facts.liveRatio >= threshold ? 'dealer' : 'self';
}
