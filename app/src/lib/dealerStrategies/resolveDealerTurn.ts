import type { DealerContext, DealerStrategy } from './types';

/**
 * Resolve the shooting target a strategy intends to use *after* its chosen
 * item is consumed. The strategy is consulted repeatedly, simulating the
 * consumption of each item it proposes, until it finally recommends a shoot
 * action. This guarantees a deterministic target while keeping the dealer to
 * a single real item use per turn.
 */
// 前置条件：本函数用思考时刻的 ctx 模拟道具后的射击决策，假设策略的
// 射击选择只依赖 liveCount/blankCount（道具执行不改变弹壳分布）。若未来
// 策略将 HP/sawActive 等会被道具改变的状态纳入射击决策，此处需改为
// 道具执行后实际重调 decide。
function resolvePostItemShootTarget(
  strategy: DealerStrategy,
  ctx: DealerContext,
  consumedItemIds: string[] = []
): 'self' | 'dealer' {
  const decision = strategy.decide({
    ...ctx,
    dealerItems: ctx.dealerItems.filter((i) => !consumedItemIds.includes(i.id)),
  });

  if (decision.action === 'shoot-self') return 'self';
  if (decision.action === 'shoot-player') return 'dealer';

  // The strategy wants to use another item. We will not actually use it this
  // turn, but we simulate its consumption so the recursion still terminates
  // (dealerItems is finite) and returns the shoot target the strategy would
  // eventually settle on.
  if (decision.itemId) {
    return resolvePostItemShootTarget(strategy, ctx, [...consumedItemIds, decision.itemId]);
  }

  return 'dealer';
}

export type DealerTurnDecision =
  | { action: 'shoot'; target: 'self' | 'dealer' }
  | { action: 'use-item'; itemId: string; shootTarget: 'self' | 'dealer' };

/**
 * Resolve the full dealer turn decision for the current strategy and context.
 *
 * - If the strategy wants to shoot, the target is returned directly.
 * - If the strategy wants to use an item, the item id and the locked
 *   post-item shooting target are returned together. This prevents the target
 *   from drifting during the item animation / thinking delay.
 */
export function resolveDealerTurnDecision(
  strategy: DealerStrategy,
  ctx: DealerContext
): DealerTurnDecision {
  const decision = strategy.decide(ctx);

  if (decision.action === 'shoot-self') {
    return { action: 'shoot', target: 'self' };
  }

  if (decision.action === 'shoot-player') {
    return { action: 'shoot', target: 'dealer' };
  }

  // `decision.action === 'use-item'`
  const itemId = decision.itemId;
  if (!itemId) {
    // Defensive fallback: if a use-item decision somehow lacks an id, shoot.
    return { action: 'shoot', target: 'dealer' };
  }

  const shootTarget = resolvePostItemShootTarget(strategy, ctx, [itemId]);
  return { action: 'use-item', itemId, shootTarget };
}
