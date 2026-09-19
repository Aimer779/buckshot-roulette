import type { DealerContext, DealerDecision, DealerStrategy } from './types';
import { balancedStrategy } from './balancedStrategy';
import { JEV_STRATEGY_ID } from './jev/types';

export const jevStrategy: DealerStrategy = {
  id: JEV_STRATEGY_ID,
  name: 'Jev · System One',
  description:
    'TypeSafe Jev 实时决策。只在合法动作里选，返回概率和置信度；失败时回退均衡型。',

  decide(ctx: DealerContext): DealerDecision {
    return balancedStrategy.decide(ctx);
  },
};
