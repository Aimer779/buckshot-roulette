import type { Shell, ShellType } from '@/store/gameStore';

export type ReloadReason = 'empty' | 'no-live';

export function getRemainingShells(
  shells: Shell[],
  currentShellIndex: number
): Shell[] {
  return shells.slice(currentShellIndex);
}

export function countShells(shells: Shell[]): Record<ShellType, number> {
  return shells.reduce(
    (counts, shell) => ({
      ...counts,
      [shell.type]: counts[shell.type] + 1,
    }),
    { live: 0, blank: 0 } satisfies Record<ShellType, number>
  );
}

export function getReloadReason(
  shells: Shell[],
  currentShellIndex: number
): ReloadReason | null {
  const remaining = getRemainingShells(shells, currentShellIndex);
  if (remaining.length === 0) return 'empty';

  const counts = countShells(remaining);
  return counts.live === 0 ? 'no-live' : null;
}
