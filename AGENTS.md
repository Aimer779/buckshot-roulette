# Repository Guidelines

## Project Structure & Module Organization

This repository contains a Buckshot Roulette web game. The runnable app lives in `app/` and uses React 19, TypeScript, Vite 7, Tailwind CSS, shadcn/ui-style components, Zustand, React Router 7, Framer Motion/GSAP, and Howler.

- `app/src/pages/`: route-level screens such as title, tutorial, gameplay, and game over.
- `app/src/components/`: reusable UI and game display components. Shared primitives are in `app/src/components/ui/`; gameplay-specific display pieces are in `app/src/components/gameplay/`; tutorial layout, controls, and page sections are in `app/src/components/tutorial/`.
- `app/src/hooks/`: gameplay orchestration hooks, including shooting animation, round lifecycle, dealer turns, item use, and page-level controller wiring.
- `app/src/lib/`: core game utilities. `gameEngine.ts` covers shell loading, damage, item distribution, dealer decisions, and game-over checks; `shotResolution.ts`, `shellFlow.ts`, and `itemEffects.ts` isolate shot, reload, and item-effect rules; `sound.ts` wraps Howler; `tutorialAnimations.ts` holds tutorial Framer Motion variants and easings.
- `app/src/data/`: static display content only (no game rules or side effects), such as `tutorialContent.ts` for tutorial item details, combos, and survival tips.
- `app/src/store/`: Zustand game state, domain types, round config, item metadata, and store actions.
- `app/public/`: browser-served visual assets for backgrounds, shotgun, and items.
- `research/`: gameplay research and mechanic notes.
- `plans/`, `info.md`, and `plan.md`: implementation plans, project notes, and planning documents.

## Build, Test, and Development Commands

Run commands from `app/` unless noted.

- `rtk pnpm install`: install dependencies from `pnpm-lock.yaml`.
- `rtk pnpm dev`: start the Vite development server, usually at `http://localhost:5173/`.
- `rtk pnpm build`: type-check with `tsc -b` and build production assets into `app/dist/`.
- `rtk pnpm lint`: run ESLint across the app.
- `rtk pnpm preview`: serve the production build locally for verification.

## Coding Style & Naming Conventions

Use TypeScript and React function components. Keep page components in PascalCase files such as `GameplayScreen.tsx`; hooks should use `useX` naming consistent with existing files such as `useDealerTurn` and `useRoundLifecycle`. Prefer small, focused components and keep game rules in `lib/`, `hooks/`, or `store/` instead of embedding them in view components. Styling is Tailwind-first, with shared class composition via `app/src/lib/utils.ts` where appropriate.

Gameplay changes should preserve the current layering:

- State shape, actions, round config, and item metadata belong in `app/src/store/gameStore.ts`.
- Pure or mostly pure rule calculations belong in `app/src/lib/`.
- Turn sequencing, timers, navigation side effects, and orchestration belong in `app/src/hooks/`.
- `GameplayScreen.tsx` should remain a route-level composition file; visual sections should stay in `app/src/components/gameplay/`.
- Routes are declared with `Routes`/`Route` in `app/src/App.tsx` and wrapped by `BrowserRouter` in `app/src/main.tsx`.

## Testing Guidelines

There is currently no dedicated test script or test framework configured. Before opening changes, run `rtk pnpm lint` and `rtk pnpm build` from `app/`. For gameplay logic changes, manually exercise the affected flow in `rtk pnpm dev`, including shell reloads, known blank/live tail behavior, round transitions, item effects, handcuff skips, saw damage, dealer AI turns, and game-over states. If tests are added later, colocate them near the code they cover and add a package script.

## Commit & Pull Request Guidelines

Recent history uses short subjects such as `refactor: extract dealer turn and gameplay controller (batch 4)`, `fix: refactor shot sequence and saw damage`, and `docs: add project README`. Keep commits focused, use a clear type prefix like `fix:`, `docs:`, `refactor:`, or `feat:`, and describe the visible behavior changed.

Do not create commits or push branches unless the user explicitly asks for it.

Pull requests should include a concise summary, validation commands run, linked issues when applicable, and screenshots or short recordings for UI/gameplay changes. Note any changes to game mechanics, item behavior, or assets explicitly.

## Agent-Specific Instructions

Do not overwrite an existing `AGENTS.md`. Use `rg` for search. If `rtk` is available, prefix `git`, `gh`, `pnpm`, and supported test commands with `rtk` to keep command output compact. Prefer `pnpm` for dependency operations and ask for confirmation before adding production dependencies.
