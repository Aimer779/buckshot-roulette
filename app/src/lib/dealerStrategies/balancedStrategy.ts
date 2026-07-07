import type { DealerContext, DealerDecision, DealerStrategy } from './types';
import { pickPriorityItem } from './_helpers';

export const balancedStrategy: DealerStrategy = {
  id: 'balanced',
  name: '均衡型',
  description: '默认庄家风格。按当前实际生效的规则决策：空包占优时射击自己，否则射击玩家。',

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

    // Replicates the rule actually enforced by useDealerTurn:
    // shoot self only when blanks are strictly dominant.
    if (blankRatio > 0.5) {
      return { action: 'shoot-self', reasoning: 'More blanks likely, shoot self' };
    }
    return { action: 'shoot-player', reasoning: 'Live shells dominant or tied, shoot player' };
  },
};
