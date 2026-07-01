# GameplayScreen Refactor Plan

## Background

`app/src/pages/GameplayScreen.tsx` is currently responsible for too many concerns:

- Round lifecycle: initialization, round transitions, retry/advance, game over navigation.
- Gameplay actions: player shots, dealer shots, shell reload checks, item use.
- Dealer behavior: AI decision timing, item execution, shooting execution.
- UI effects: toasts, muzzle flash, screen shake, blood flash, damage text, item animations.
- Rendering: top HUD, dealer area, shotgun stage, player controls, overlays, settings.

The refactor should preserve current behavior first, then extract logic into smaller units that can be tested.

## Goals

1. Reduce `GameplayScreen.tsx` to page composition plus controller wiring.
2. Separate gameplay rules from React rendering and animation timing.
3. Make shell flow, shot resolution, item effects, and dealer actions testable as pure logic where possible.
4. Centralize timers and animation locks to reduce stale callback and unmounted-update risks.
5. Keep the first refactor behavior-preserving; behavior fixes should be isolated after structural changes.

## Non-Goals

- Do not redesign the gameplay UI in this refactor.
- Do not change round rules, item behavior, or AI behavior during the initial extraction, except for explicitly confirmed pre-existing bugs that are called out in this plan.
- Do not add new production dependencies.
- Do not change the Zustand store field structure unless a later behavior fix requires it. Adjusting action behavior is allowed for confirmed bugs, such as the saw damage bug described below.

## Current Pressure Points

### Single Component With Mixed Responsibilities

`GameplayScreen.tsx` manages store state, local animation state, timers, sound effects, navigation, game rules, and all JSX. This makes small behavior changes risky because gameplay logic and UI effects are interleaved.

### Timer Sprawl

The component uses many `setTimeout` calls for round announcements, shot sequencing, dealer thinking, item effects, round transitions, game-over navigation, blood flash, screen shake, muzzle flash, shell eject, and damage text.

Some timers are cleaned up by effect cleanup, but many local timers inside callbacks are not centrally tracked.

### Rule Duplication

Player and dealer item use are handled in separate switch statements. Some item rules overlap, but behavior is implemented twice or partially differently.

### Shot Resolution Coupling

The shooting flow consumes shells, triggers animation, plays sound effects, applies damage, updates saw state, checks reloads, and switches phase in one path.

### Confirmed Saw Damage Bug

The page calculates damage from `sawActive`, then calls `damage`. The store `damage` action also applies saw-based doubling.

This is a confirmed pre-existing bug, not a theoretical risk. When the saw is active, the page passes `2`, then the store doubles it to `4`. The affected paths are:

- Player shoots self.
- Player shoots dealer.
- Dealer shoots self.
- Dealer shoots player.

Hard requirement: after the shot-resolution refactor, saw damage must be exactly `2`, not the current accidental `4`.

### Dealer Decision Inconsistency

The dealer turn effect calls `dealerDecision`, but `executeDealerShoot` recalculates whether the dealer shoots self based on blank ratio instead of directly using `dealerDecision`'s `shoot-self` / `shoot-player` result. Treat this as a behavior issue to isolate after the structural refactor.

## Target Structure

The repository currently uses a mostly flat structure:

- `app/src/components/`
- `app/src/hooks/`
- `app/src/lib/`
- `app/src/pages/`
- `app/src/store/`

There is no existing `features/` convention. Prefer the existing flat style unless the refactor becomes large enough to justify a new feature directory.

Recommended structure that fits the current codebase:

```text
app/src/pages/GameplayScreen.tsx
app/src/components/gameplay/
  GameplayHud.tsx
  DealerArea.tsx
  ShotgunStage.tsx
  PlayerArea.tsx
  GameplayOverlays.tsx
  SettingsDialog.tsx
app/src/hooks/
  useGameplayController.ts
  useRoundLifecycle.ts
  useShootSequence.ts
  useDealerTurn.ts
  usePlayerItems.ts
  useGameplayEffects.ts
app/src/lib/
  gameEngine.ts
  shellFlow.ts
  shotResolution.ts
  itemEffects.ts
  dealerActions.ts
```

Alternative structure, only if the team decides to introduce feature folders:

```text
app/src/pages/GameplayScreen.tsx
app/src/features/gameplay/
  components/
    GameplayHud.tsx
    DealerArea.tsx
    ShotgunStage.tsx
    PlayerArea.tsx
    GameplayOverlays.tsx
    SettingsDialog.tsx
  hooks/
    useGameplayController.ts
    useRoundLifecycle.ts
    useShootSequence.ts
    useDealerTurn.ts
    usePlayerItems.ts
    useGameplayEffects.ts
  logic/
    shellFlow.ts
    shotResolution.ts
    itemEffects.ts
    dealerActions.ts
    gameplayTypes.ts
```

If the feature-folder option is chosen, document that this is a new project convention. Otherwise use `components/gameplay`, `hooks`, and `lib` to match the existing repository layout.

## Phase 1: Establish A Baseline

Before editing behavior, record the current working state.

1. Run:

```bash
rtk pnpm lint
rtk pnpm build
```

2. Manually exercise the current game through:

- Round start announcement.
- Player shoots self with blank.
- Player shoots self with live.
- Player shoots dealer.
- Dealer turn.
- Handcuffs skip.
- Beer eject.
- Magnifier reveal.
- Medicine success/failure.
- Inverter shell flip.
- Phone reveal.
- Round win, round retry, and final game over.

3. Note known behavior issues separately. Do not fix them in the first structural pass unless they block the refactor.

Known confirmed behavior bug to record before refactoring:

- Saw damage currently deals `4` instead of `2` because damage is doubled in both the page and the store.

Known behavior issue to preserve initially and fix later:

- Dealer shooting target can diverge from `dealerDecision`, because the shoot target is recalculated in the execution path.

## Phase 1.5: Audit Existing Engine Abstractions

Before creating new logic modules, audit `app/src/lib/gameEngine.ts`. It already exports useful pure helpers:

- `calculateDamage(hasSaw)`
- `getLiveShellCount(shells, fromIndex)`
- `getBlankShellCount(shells, fromIndex)`
- `resolveItemUse(itemType, context)`
- `dealerDecision(...)`
- `checkGameOver(...)`

Do not create parallel abstractions without deciding whether to reuse, extend, or replace these functions.

Decisions to make:

1. Use `calculateDamage` inside `shotResolution`, or move its logic into `shotResolution` and remove the older helper later.
2. Reuse `getLiveShellCount` / `getBlankShellCount`, or replace them with a single `countShells` helper and update call sites.
3. Decide whether `resolveItemUse` should be extended into the unified item executor, or deprecated in favor of a more complete result type.

This phase should produce a reuse decision table before logic extraction starts. Later phases must follow that table instead of reopening the same decisions.

Suggested table format:

```text
Existing helper | Decision | Follow-up
calculateDamage | reuse in shotResolution | remove page-level inline damage calculation
getLiveShellCount/getBlankShellCount | reuse or replace | update all counting call sites
resolveItemUse | extend or replace | avoid keeping two active item-effect abstractions
```

Batch 2 decision table:

```text
Existing helper | Decision | Follow-up
calculateDamage | reuse in shotResolution | shotResolution is the only saw-aware damage source; store damage applies exact requested HP delta
getLiveShellCount/getBlankShellCount | replace internally with shellFlow.countShells/getRemainingShells | keep old exports as compatibility wrappers until all call sites move to shellFlow
resolveItemUse | defer replacement/extension | Phase 7 should decide the unified item executor shape before changing item behavior
dealerDecision | reuse as-is | preserve current dealer target recalculation behavior in this batch
checkGameOver | reuse as-is | no round lifecycle behavior change in this batch
```

## Phase 2: Extract Render Components

This is the safest first extraction because it should only move JSX and props.

Keep the root page layout and the screen-shake wrapper in `GameplayScreen.tsx` during the first JSX extraction. The `shakeScreen` state drives the `motion.div` that wraps the whole game area, so moving it too early can create awkward prop threading. It can later move into `GameplayShell` or remain in the page composition layer.

`containerRef` appears to be mounted but unused. It can be removed in a small cleanup commit if confirmed by search.

### `GameplayHud.tsx`

Extract the top HUD bar.

Inputs:

- `phase`
- `dealerThinking`
- `currentRound`
- `maxRounds`
- `roundLabel`
- `sawActive`
- `skipDealerTurn`
- `settingsOpen`
- `onToggleSettings`

### `DealerArea.tsx`

Extract dealer HP, dealer items, and dealer silhouette.

Inputs:

- `dealerHP`
- `dealerMaxHP`
- `dealerItems`
- `phase`
- `dealerThinking`

### `ShotgunStage.tsx`

Extract the shell indicator, shotgun image, muzzle flash, shell eject animation, revealed-shell display, and item-effect badge.

Inputs:

- `shells`
- `currentShellIndex`
- `shootingAnim`
- `muzzleFlash`
- `shellEjectAnim`
- `ejectedShellType`
- `revealedShellIndex`
- `itemEffectAnim`

### `PlayerArea.tsx`

Extract player HP, item cards, and shot action buttons.

Inputs:

- `playerHP`
- `playerMaxHP`
- `playerItems`
- `actionsEnabled`
- `onUseItem`
- `onShootSelf`
- `onShootDealer`

### `GameplayOverlays.tsx`

Extract fixed overlays.

Inputs:

- `roundAnnounce`
- `currentRound`
- `roundLabel`
- `showGuillotineWarning`
- `bloodFlash`
- `damageFloatingText`
- `settingsOpen`
- `phase`
- `dealerThinking`
- `itemEffectAnim`
- `toasts`
- `onDismissToast`
- `onCloseSettings`
- `onQuit`

### `SettingsDialog.tsx`

This may be included inside `GameplayOverlays.tsx` initially, then split out if the overlay file gets too large.

## Phase 3: Centralize UI Effects

Create `useGameplayEffects.ts`.

Responsibilities:

- Toast queue:
  - `toasts`
  - `pushToast`
  - `dismissToast`
- Short UI effects:
  - `triggerBloodFlash`
  - `triggerShake`
  - `triggerMuzzleFlash`
  - `showDamageText`
  - `showItemEffect`
  - `showShellEject`
  - `showRevealedShell`
- Timer cleanup on unmount.

The page should stop owning most short-lived animation states directly.

`actionsEnabled` must continue to depend on `roundAnnounce`. During and after this extraction, player buttons and item cards must remain disabled while the round announcement is visible.

## Phase 4: Extract Shot Sequence

Create `useShootSequence.ts`.

Responsibilities:

- Guard animation lock.
- Consume the current shell.
- Set phase to `ANIMATING`.
- Set `shootingAnim`.
- Trigger pump, fire/click, and shell eject effects.
- Return the consumed shell type after the animation completes.

Suggested interface:

```ts
type ShootTarget = 'self' | 'dealer';

function useShootSequence(...): {
  isAnimatingRef: React.MutableRefObject<boolean>;
  shoot: (target: ShootTarget) => Promise<'live' | 'blank' | null>;
}
```

Create `shotResolution.ts`.

Responsibilities:

- Decide whether a shot causes damage.
- Decide who receives damage.
- Decide whether the actor keeps the turn on blank self-shot.
- Calculate damage exactly once.

Suggested interface:

```ts
type Actor = 'player' | 'dealer';
type Target = 'player' | 'dealer';

function resolveShotOutcome(input: {
  actor: Actor;
  target: Target;
  shellType: 'live' | 'blank';
  sawActive: boolean;
}): ShotOutcome;
```

Important: audit the current `damage` action before changing damage calculation. Avoid keeping saw-based doubling in both page logic and store logic.

Hard acceptance criteria:

- Normal live shell damage is `1`.
- Saw live shell damage is `2`.
- Saw state is cleared after the shot is resolved.
- The store and page/controller must not both apply saw doubling.

Recommended fix direction:

- Use one source of truth for damage calculation, preferably `shotResolution` backed by `calculateDamage`.
- Change the store `damage` action so it only applies the requested HP delta, or call it with a base damage and remove page/controller pre-calculation. Pick one, document it, and verify all shot paths.

## Phase 5: Extract Shell Flow

Create `shellFlow.ts`.

Follow the Phase 1.5 reuse decision table for existing `gameEngine.ts` helpers. `getLiveShellCount` and `getBlankShellCount` already exist. If `countShells` is added, it should replace duplicated counting logic rather than coexist unused.

Pure helpers:

```ts
function getRemainingShells(shells: Shell[], currentShellIndex: number): Shell[];

function getReloadReason(
  shells: Shell[],
  currentShellIndex: number
): 'empty' | 'no-live' | null;

function countShells(shells: Shell[]): {
  live: number;
  blank: number;
};
```

The React controller or lifecycle hook remains responsible for:

- Calling `loadShells`.
- Updating the store.
- Logging reload messages.
- Showing toast messages if needed.
- Scheduling phase changes after reload.

## Phase 6: Extract Round Lifecycle

Create `useRoundLifecycle.ts`.

Move these responsibilities out of the page:

- Gameplay BGM startup.
- First round initialization.
- Round initialization after `nextRound`.
- Guillotine trigger detection.
- Game-over detection.
- Delayed navigation to `/gameover`.
- Delayed `nextRound` / `retryRound` after `ROUND_END`.

This hook should accept dependencies like `navigate`, `pushToast`, and UI effect callbacks rather than importing UI components.

### Refs To Preserve

The lifecycle extraction must preserve these refs and their semantics:

- `initializedRoundRef`: prevents the same round from being initialized repeatedly after `nextRound` sets `phase` to `ROUND_START`.
- `pendingRoundEndRef`: passes `'won'` / `'lost'` from the game-over detection effect to the delayed round-end transition effect.

Do not replace these with local variables inside individual effects. If they move into `useRoundLifecycle`, they should stay as refs owned by that hook.

### Round Announcement Coupling

`roundAnnounce` is not purely visual; it also gates `actionsEnabled`. If round announcement state moves into `useRoundLifecycle` or `useGameplayEffects`, the controller must still expose it so player actions remain disabled during the announcement.

## Phase 7: Unify Item Effects

Create `itemEffects.ts`.

Follow the Phase 1.5 reuse decision table for `resolveItemUse` and `ItemEffect`. If the decision is to extend them, `itemEffects.ts` should wrap or build on the existing engine helper. If the decision is to replace them, mark the old helper as deprecated or remove it in the same cleanup path.

The first version can be a rule executor that returns a result object, without directly touching React state.

Suggested result shape:

```ts
type ItemEffectResult = {
  consumedItemIds: string[];
  addedItems?: Item[];
  removedOpponentItemIds?: string[];
  hpChanges?: Array<{
    target: 'player' | 'dealer';
    amount: number;
    kind: 'damage' | 'heal';
  }>;
  shellChanges?: Shell[];
  revealedShellIndex?: number;
  ejectShell?: {
    type: 'live' | 'blank';
  };
  sawActive?: boolean;
  skipDealerTurn?: boolean;
  log?: {
    message: string;
    type: 'info' | 'damage' | 'heal' | 'item' | 'system';
  };
  sfx?: string;
  uiEffect?: Item['type'];
};
```

Then create `usePlayerItems.ts` or handle application inside `useGameplayController`.

Rules to preserve:

- Cigarette heals only if healing is allowed and HP is not full.
- Guillotine blocks healing items.
- Handsaw enables next-shot double damage.
- Handcuffs skips the dealer turn.
- Beer consumes the current shell and may cause reload.
- Magnifier reveals the current shell.
- Adrenaline steals a random dealer item.
- Medicine randomly heals 2 or damages 1.
- Inverter flips the current shell.
- Phone reveals a random future unrevealed shell.

Dealer item behavior should share this rule layer where possible. UI feedback can remain different.

If a new `ItemEffectResult` is introduced, document why the existing `ItemEffect` shape is insufficient. Avoid keeping two active item-effect abstractions long term.

## Phase 8: Extract Dealer Turn

Create `useDealerTurn.ts`.

Responsibilities:

- React to `phase === 'DEALER_TURN'`.
- Handle skip-turn from handcuffs.
- Reload before dealer thinking if needed.
- Set and clear `dealerThinking`.
- Call `dealerDecision`.
- Execute dealer item use.
- Execute dealer shot.
- Return control to player when appropriate.

Create `dealerActions.ts` if the action execution becomes large.

Important: preserve current behavior first. The current implementation calculates a dealer decision, but the shoot action is later re-decided by shell ratio. Fixing that should be a separate behavior change after tests or manual baseline verification.

Preserve the dealer blank-self-shot extra-turn behavior. Currently this is implemented by setting `phase` back to `DEALER_TURN`, which retriggers the dealer-turn effect. If the refactor changes this to a Promise or sequential flow, it must still allow the dealer to act again after shooting itself with a blank.

## Phase 9: Add Gameplay Controller

Create `useGameplayController.ts` as the main page integration point.

It should return:

```ts
{
  state: {
    phase;
    playerHP;
    playerMaxHP;
    dealerHP;
    dealerMaxHP;
    shells;
    currentShellIndex;
    playerItems;
    dealerItems;
    currentRound;
    maxRounds;
    sawActive;
    skipDealerTurn;
    dealerThinking;
    actionsEnabled;
    roundLabel;
  };
  ui: {
    toasts;
    roundAnnounce;
    shootingAnim;
    muzzleFlash;
    bloodFlash;
    shakeScreen;
    shellEjectAnim;
    ejectedShellType;
    showGuillotineWarning;
    itemEffectAnim;
    revealedShellIndex;
    damageFloatingText;
    settingsOpen;
  };
  actions: {
    shootSelf;
    shootDealer;
    useItem;
    dismissToast;
    toggleSettings;
    closeSettings;
    quit;
  };
}
```

After this phase, `GameplayScreen.tsx` should mainly compose:

- `GameplayHud`
- `GameLogPanel`
- `DealerArea`
- `ShotgunStage`
- `PlayerArea`
- `GameplayOverlays`

## Phase 10: Verification

Run after each phase:

```bash
rtk pnpm lint
rtk pnpm build
```

Manual verification after larger phases:

- Start a new game.
- Complete round 1.
- Win and advance to round 2.
- Lose and retry a round.
- Reach round 3.
- Trigger guillotine.
- Finish as player win and dealer win.
- Quit to title while timers are pending.

Specific acceptance checks:

- Saw live shot deals exactly `2` damage.
- Saw live shot does not deal `4` damage.
- Player actions are disabled during round announcement.
- Dealer keeps the turn after shooting itself with a blank.
- Round win advances after the delayed `ROUND_END` transition.
- Round loss retries after the delayed `ROUND_END` transition.

## Suggested Tests

There is currently no dedicated test script. If the refactor proceeds into pure logic extraction, adding a test framework becomes an explicit task rather than a casual follow-up.

Recommended test setup task:

- Add a dev-only test runner, preferably Vitest because this is a Vite app.
- Add a `test` or `test:run` script in `app/package.json`.
- Keep tests focused on pure logic first.

Recommended coverage:

- `shellFlow.getReloadReason`
- `shellFlow.countShells`
- `shotResolution.resolveShotOutcome`
- `itemEffects.executeItemEffect` or the extended `gameEngine.resolveItemUse`
- `dealerActions` for decision-to-action mapping

Keep UI integration tests optional until the logic layer is stable.

## Evaluation

### Feasibility

The plan is feasible and can be done incrementally. The safest path is to extract JSX first, because that reduces file size without changing behavior. Logic extraction should happen only after the visual component boundaries are stable.

### Main Risks

1. Timer behavior changes accidentally during hook extraction.
2. Saw damage is currently a confirmed bug: damage is doubled in more than one place and must be fixed deliberately.
3. Dealer behavior changes because the AI decision result is not currently the single source of truth for shooting.
4. Item behavior changes when merging player and dealer item handling.
5. Store access via `useGameStore.getState()` can hide stale assumptions during async callbacks.
6. New logic files duplicate existing `gameEngine.ts` helpers instead of reusing or replacing them intentionally.

### Recommended Cut Size

Use small PR-sized commits or checkpoints:

1. Extract render components only.
2. Extract UI effects/timers.
3. Extract shot sequence and shell flow.
4. Extract round lifecycle.
5. Extract item effects.
6. Extract dealer turn.
7. Apply behavior fixes with tests or explicit manual verification.

### Priority

High-value first steps:

1. Extract `PlayerArea`, `DealerArea`, `ShotgunStage`, and `GameplayHud`.
2. Centralize timers in `useGameplayEffects`.
3. Audit and fix damage calculation once `shotResolution` exists.

Lower priority:

- Full item rule unification.
- Dealer AI behavior correction.
- Adding a test framework, unless gameplay logic work continues.

### Final Recommendation

Proceed with the refactor, but keep behavior-preserving structural work separate from behavior fixes except for the confirmed saw damage bug, which should become a hard acceptance check once shot resolution is extracted. The biggest practical win is reducing `GameplayScreen.tsx` to a controller-driven page, moving fragile timer logic into one cleanup-aware hook, and reusing or deliberately replacing existing `gameEngine.ts` helpers instead of creating parallel rule abstractions.
