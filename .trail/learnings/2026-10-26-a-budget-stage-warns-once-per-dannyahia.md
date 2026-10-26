---
title: A budget stage warns once per period but re-arms when spending drops back
author: DannyahIA
date: 2026-10-26
branch: feat/meu-dinheiro-categorias
cost: { minutes: 115, tokens: 818658 }
id: l-d11ecf1e
scope: repo
status: active
src: agent
touches:
  - docs/domain.md
  - src/app/accounts/budget-rows.test.ts
  - src/app/accounts/budget-rows.ts
  - src/app/accounts/budgets-tab.tsx
  - src/app/budgets/budget-row.test.tsx
  - src/app/budgets/budget-row.tsx
  - src/modules/dashboard/application/metrics/calculate-budget-pace.ts
  - src/app/transactions/actions.ts
  - src/modules/budgets/domain/should-check-alerts-after-edit.test.ts
  - src/modules/budgets/domain/should-check-alerts-after-edit.ts
---

## Decided

- Budget alerts (src/modules/budgets/application/check-budget-alerts.use-case.ts) claim each stage (75/90/95/100, pace) in budget_alerts keyed by (budget_id, period_start, stage). `insert … on conflict do nothing returning` decides who sends, so two concurrent purchases never both warn.
- Each check first releases claimed stages that spending no longer reaches (`staleStages` in budget-alerts.ts). Without this, an undone "mercado 400" typo used up the 75% stage for the whole month and the real 75% never warned.
- The over-limit line ("R$ X acima") is not claimed. It goes out with every new purchase past the limit. Edits only check when the amount rose or the category or date changed (`shouldCheckAlertsAfterEdit`), so a typo fix stays quiet.
- App actions check synchronously after their own transaction commits (for the toast) and send the same lines to Telegram in `after()`. They never call AnnounceBudgetAlertsUseCase, which would claim a second time.

## Tried and ruled out

- Putting the alert inside the Telegram purchase message (the old `budgetAlert` in recordedView): every button tap re-renders that message, so it repeated. Alerts are now a separate message.
- Filling `touched` on "Foi no débito/crédito": a move never changes a category's spend and only repeated the over line.

## Watch out

- Period keys use the process's local time (DateRange.monthOf). The Next server and `pnpm telegram:poll` must run in the same TZ, or a stage could be claimed under two period_start keys.
- Before this branch the only real budget (Transporte, Sept) had expired, which is why "the alert never works" was reported. Budgets are now monthly by default.
