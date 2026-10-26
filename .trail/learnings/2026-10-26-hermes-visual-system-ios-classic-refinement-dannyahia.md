---
title: 'Hermes visual system: iOS-classic refinement, Sileo not adopted'
author: DannyahIA
date: 2026-10-26
branch: feat/meu-dinheiro-categorias
cost: { minutes: 12, tokens: 362539 }
id: l-b62b4803
scope: repo
status: active
src: agent
touches:
  - src/modules/categories/application/get-categories-overview.use-case.test.ts
  - src/modules/categories/application/get-categories-overview.use-case.ts
  - src/app/categories/category-suggestions.test.tsx
  - src/app/categories/category-suggestions.tsx
  - src/app/categories/actions.ts
  - src/app/categories/category-detail.tsx
  - src/app/categories/category-display.ts
  - src/app/categories/category-list.test.tsx
---

## Decided

- Keep the custom toast store (src/shared/hooks/use-toast.ts, src/components/ui/toaster.tsx) and restyle it; do not adopt Sileo. Sileo is 0.1.x (pre-1.0), pulls in the 'motion' dependency, and its physics/pill morph clashes with the no-capsule-everywhere rule, while the store already has 26 call sites plus an action/undo button.
- Visual direction is classic iOS grammar on top of the existing Prancheta blueprint-blue identity, not a replacement: tokens live only in src/app/globals.css, one font (Inter) with tabular figures instead of Plex Mono, solid 3-level surfaces, success is green (it used to be blue = primary).

## Watch out

- next build writes .next and the user's live dev server (port 3000) may be running, so it was not run during the redesign; verify the build before merging.
- Native <dialog> animates with @starting-style + allow-discrete (.dialog-sheet in globals.css); margin/radius overrides for the phone bottom sheet must be Tailwind max-sm utilities in dialog.tsx, because unlayered/@layer components CSS loses to utilities.
