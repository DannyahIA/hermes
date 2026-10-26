---
title: "Hermes is monochrome with a Linear canvas; Sileo's look, not its package"
author: DannyahIA
date: 2026-10-26
branch: feat/meu-dinheiro-categorias
cost: { minutes: 22, tokens: 512631 }
id: l-c5d133e0
scope: repo
status: active
replaces: l-b62b4803
src: agent
touches:
  - src/app/globals.css
  - src/components/ui/section.tsx
  - src/components/ui/page-header.tsx
  - src/shared/components/theme-toggle.tsx
  - src/components/layout/app-shell-chrome.tsx
  - src/components/ui/toaster.test.tsx
  - src/components/ui/toaster.tsx
---

## Decided

- The visual system is monochrome 'Prancheta in ink' (src/app/globals.css): black/white primary, blue only for focus/selection/info (--ring, --info), green/red/amber only for meaning. It replaces the blue iOS-classic pass of the same week, which the user found too blue and too much like a white-card SaaS dashboard.
- Layout follows Linear: sidebar on the window colour, one canvas (--card) for content; lists and summaries are open Sections (src/components/ui/section.tsx) with hairline dividers, Card only for one object or a chart. Page titles go through PageHeader (data-page-title), and AppShellChrome shows the title in its header only after that h1 scrolls away.
- Sileo 0.1.6 stays out; its look (ink toast, coloured state badge, short entrance) lives in src/components/ui/toaster.tsx. Read from the published package: each toast is a <button> with the action ('Desfazer') as an <a href='#'> nested inside it, there is no close button and no role=alert for errors, and it pulls in 'motion'. Our store has 26 call sites with an undo action.
- Muted text is #666666, not the suggested #737373: #737373 is 4.35:1 on the #f5f5f5 window colour. Red is #c81e1e for the same reason. --faint-foreground (#a3a3a3) is decoration only.

## Watch out

- Run next build on a copy (rsync the repo to a scratch dir, hard-link node_modules), not in place: the user's dev server on port 3000 shares .next.
- Native <dialog> animates via @starting-style in .dialog-sheet; the phone bottom-sheet geometry must be Tailwind max-sm utilities in dialog.tsx, because @layer components CSS loses to utilities.
