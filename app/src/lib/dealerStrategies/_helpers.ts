import type { Item } from '@/store/gameStore';
import type { DealerContext, DealerDecision } from './types';

export function pickPriorityItem(
  ctx: DealerContext,
  liveRatio: number
): DealerDecision | null {
  const { dealerHP, dealerMaxHP, guillotineTriggered, dealerItems, shellsRemaining, dealerSawActive } = ctx;

  // 1. Heal when hurt and allowed
  if (!guillotineTriggered && dealerHP <= Math.ceil(dealerMaxHP / 2)) {
    const cig = dealerItems.find((i) => i.type === 'cigarette');
    if (cig) {
      return { action: 'use-item', itemId: cig.id, reasoning: 'HP low, use cigarette' };
    }
  }

  // 2. Handcuffs to restrict the player
  const cuffs = dealerItems.find((i) => i.type === 'handcuffs');
  if (cuffs && shellsRemaining > 2) {
    return { action: 'use-item', itemId: cuffs.id, reasoning: 'Restrict player turn' };
  }

  // 3. Handsaw when live ratio is favorable
  if (!dealerSawActive && liveRatio > 0.5) {
    const saw = dealerItems.find((i) => i.type === 'handsaw');
    if (saw) {
      return { action: 'use-item', itemId: saw.id, reasoning: 'High live ratio, prepare saw' };
    }
  }

  // 4. Phone for intel
  const phone = dealerItems.find((i) => i.type === 'phone');
  if (phone && shellsRemaining > 2) {
    return { action: 'use-item', itemId: phone.id, reasoning: 'Gather intel with phone' };
  }

  return null;
}

export function findItemById(items: Item[], itemId: string | undefined): Item | undefined {
  return items.find((i) => i.id === itemId);
}
