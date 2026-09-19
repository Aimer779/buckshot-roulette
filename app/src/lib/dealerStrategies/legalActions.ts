import type { DealerContext } from './types';

export const ITEM_ACTION: Record<string, string> = {
  magnifier: 'use-magnifier',
  handcuffs: 'use-handcuffs',
  cigarette: 'use-cigarette',
  beer: 'use-beer',
  handsaw: 'use-handsaw',
  adrenaline: 'use-adrenaline',
  medicine: 'use-medicine',
  inverter: 'use-inverter',
  phone: 'use-phone',
};

export const ACTION_ITEM_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(ITEM_ACTION).map(([type, action]) => [action, type])
);

/**
 * Legal dealer actions for Jev Choice options.
 * Phone and magnifier are omitted in v1 (no private knowledge store yet).
 */
export function legalDealerActions(ctx: DealerContext): string[] {
  const actions: string[] = ['shoot-self', 'shoot-player'];
  const types = new Set(ctx.dealerItems.map((item) => item.type));
  const playerItems = ctx.playerItems ?? [];
  const playerCuffed = ctx.skipPlayerTurn === true;

  if (types.has('handcuffs') && !playerCuffed && ctx.shellsRemaining > 2) {
    actions.push('use-handcuffs');
  }
  if (
    types.has('cigarette') &&
    !ctx.guillotineTriggered &&
    ctx.dealerHP < ctx.dealerMaxHP
  ) {
    actions.push('use-cigarette');
  }
  if (types.has('beer') && ctx.shellsRemaining > 0) {
    actions.push('use-beer');
  }
  if (types.has('handsaw') && !ctx.dealerSawActive) {
    actions.push('use-handsaw');
  }
  if (types.has('adrenaline') && playerItems.length > 0) {
    actions.push('use-adrenaline');
  }
  if (types.has('medicine') && !ctx.guillotineTriggered) {
    actions.push('use-medicine');
  }
  if (types.has('inverter') && ctx.shellsRemaining > 0) {
    actions.push('use-inverter');
  }

  return actions;
}

export function itemIdForAction(ctx: DealerContext, action: string): string | undefined {
  const type = ACTION_ITEM_TYPE[action];
  if (!type) return undefined;
  return ctx.dealerItems.find((item) => item.type === type)?.id;
}
