import type { DealerContext, DealerDecision, DealerStrategy } from './types';
import { pickPriorityItem } from './_helpers';

export const aggressiveStrategy: DealerStrategy = {
  id: 'aggressive',
  name: '激进型',
  description: '庄家更倾向攻击玩家，只有空包比例很高（≥60%）时才会选择射击自己。',

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

    // Aggressive: only avoid shooting the player when blanks are clearly dominant.
    if (blankRatio >= 0.6) {
      return { action: 'shoot-self', reasoning: 'Blanks strongly dominant, shoot self' };
    }
    return { action: 'shoot-player', reasoning: 'Press the attack against player' };
  },
};
