import type { DealerContext, DealerDecision, DealerStrategy } from './types';
import { pickPriorityItem } from './_helpers';

export const conservativeStrategy: DealerStrategy = {
  id: 'conservative',
  name: '保守型',
  description: '庄家更倾向自保，只要空包比例不低（≥40%）就会选择射击自己。',

  decide(ctx: DealerContext): DealerDecision {
    const { liveCount, blankCount } = ctx;
    const total = liveCount + blankCount;
    if (total === 0) {
      return { action: 'shoot-player', reasoning: 'No shells remaining' };
    }

    const liveRatio = liveCount / total;
    const blankRatio = blankCount / total;

    const itemDecision = pickPriorityItem(ctx, liveRatio);
    if (itemDecision) return itemDecision;

    // Conservative: prefer self-shot whenever blanks are reasonably common.
    if (blankRatio >= 0.4) {
      return { action: 'shoot-self', reasoning: 'Blanks common enough, play safe and shoot self' };
    }
    return { action: 'shoot-player', reasoning: 'Live shells dominant, shoot player' };
  },
};
