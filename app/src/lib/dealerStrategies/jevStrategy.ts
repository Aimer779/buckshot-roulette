import type { DealerContext, DealerDecision, DealerStrategy } from './types';
import { balancedStrategy } from './balancedStrategy';
import { JEV_STRATEGY_ID } from './jev/types';

export const jevStrategy: DealerStrategy = {
  id: JEV_STRATEGY_ID,
  name: 'Jev · System One',
  description:
    '已知弹由规则走。未知弹由 Jev 回答原子问题，代码合成动作。失败才回退均衡型。',

  decide(ctx: DealerContext): DealerDecision {
    return balancedStrategy.decide(ctx);
  },
};
