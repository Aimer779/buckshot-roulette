# Round Progression Fix Plan

## Problem

The current round progression logic treats any HP reaching zero before the final round as `next-round`. This means a player loss in round 1 or round 2 incorrectly advances to the next round. In practice, losing round 2 can move the player into round 3 instead of showing a retry/revival flow.

This also makes the flow confusing after adding tutorial skipping: round 2 may be the player's first active round, but it is still not the final round in the documented three-round story structure.

## Source Basis

Repository docs describe a three-stage story mode:

- `README.md`: "教学局 -> 道具局 -> 决胜局"
- `info.md`: first round is teaching/basic rules, second introduces items, third is the decisive round.
- `research/buckshot_rules.md`: first and second round failures should revive/retry the same round, while third round failure reaches the death ending.

Therefore, non-final player wins and non-final player losses need different outcomes.

## Desired Behavior

- Player wins round 1 or 2: advance to the next round.
- Player loses round 1 or 2: reset and retry the same round after a revival/retry message.
- Player wins round 3: set winner to `player` and navigate to `/gameover`.
- Player loses round 3: set winner to `dealer` and navigate to `/gameover`.

## Implementation Approach

Replace the single `next-round` result with explicit round outcomes. For example:

- `round-won`
- `round-lost`
- `player`
- `dealer`
- `continue`

Then update the gameplay effect to branch clearly:

- `round-won`: show a win toast/log, enter `ROUND_END`, then call `nextRound()`.
- `round-lost`: show a revival/retry toast/log, enter `ROUND_END`, then reset the current round instead of incrementing.
- `player` / `dealer`: keep the existing final game-over flow.

Add a store action such as `retryRound()` or `resetCurrentRound()` that resets HP, max HP, shells, item lists, saw/skip flags, and phase for the current round without changing `currentRound`.

## Files Involved

- `app/src/lib/gameEngine.ts`
  - Change `checkGameOver()` return type and non-final HP-zero handling.
- `app/src/pages/GameplayScreen.tsx`
  - Handle `round-won` and `round-lost` separately.
  - Keep final game-over navigation unchanged.
  - Reuse the existing `ROUND_START` initialization effect for both next round and retry round.
- `app/src/store/gameStore.ts`
  - Add `retryRound()` or equivalent current-round reset action.
  - Ensure it clears round-local state and sets `phase: 'ROUND_START'`.

## Validation Plan

1. Run `rtk pnpm build` from `app/`.
2. Start the app with `rtk pnpm dev`.
3. With tutorial/basic round enabled, lose round 1.
   - Expected: no `/gameover`; round 1 restarts with HP reset.
4. Win round 1.
   - Expected: advances to round 2.
5. Lose round 2.
   - Expected: no `/gameover`; round 2 restarts with HP reset and item distribution.
6. Win round 2.
   - Expected: advances to round 3.
7. Lose round 3.
   - Expected: navigates to `/gameover` with dealer as winner.
8. Win round 3.
   - Expected: navigates to `/gameover` with player as winner.
9. Test with "skip tutorial/basic round" enabled.
   - Expected: starting at round 2 still retries round 2 on loss and advances to round 3 on win.
