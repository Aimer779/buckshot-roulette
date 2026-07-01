import { calculateDamage } from '@/lib/gameEngine';
import type { ShellType } from '@/store/gameStore';

export type ShotActor = 'player' | 'dealer';
export type ShotTarget = 'player' | 'dealer';

export interface ShotOutcome {
  actor: ShotActor;
  target: ShotTarget;
  shellType: ShellType;
  hit: boolean;
  damageTarget: ShotTarget | null;
  damage: number;
  keepsTurn: boolean;
  sawConsumed: boolean;
}

export function resolveShotOutcome(input: {
  actor: ShotActor;
  target: ShotTarget;
  shellType: ShellType;
  sawActive: boolean;
}): ShotOutcome {
  const hit = input.shellType === 'live';

  return {
    actor: input.actor,
    target: input.target,
    shellType: input.shellType,
    hit,
    damageTarget: hit ? input.target : null,
    damage: hit ? calculateDamage(input.sawActive) : 0,
    keepsTurn:
      input.shellType === 'blank' &&
      input.actor === input.target,
    sawConsumed: hit && input.sawActive,
  };
}
