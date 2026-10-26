---
title: "A lost password is reset in the DB with better-auth's own hash"
author: DannyahIA
date: 2026-10-26
branch: feat/meu-dinheiro-categorias
cost: { minutes: 5, tokens: 109073 }
id: l-6ea6f722
scope: repo
status: active
src: agent
touches:
  - '.env.example'
  - docs/superpowers/specs/2026-10-19-contas-planejamento-categorias-design.md
  - src/app/(auth)/actions.ts
  - src/config/env.ts
  - src/infra/auth/server.ts
  - docs/ui-ux.md
  - src/app/(auth)/auth-card.tsx
  - src/app/(auth)/layout.tsx
  - src/app/(auth)/social-sign-in-buttons.tsx
  - src/app/(marketing)/page.tsx
---

## Decided

- Passwords live only as scrypt hashes in `account.password` (provider_id `credential`), so they cannot be read back. Until the reset page exists (spec 2026-10-19 §9.1), a locked-out user gets a new password set with `hashPassword` from `better-auth/crypto`, run with node from the repo root. Afterwards, check it by signing in at /api/auth/sign-in/email.
- Email verification is off (`REQUIRE_EMAIL_VERIFICATION`, default false) because RESEND_API_KEY is unset. Without it, verification and reset emails only reach the dev server log.

## Watch out

- "Can't sign up with this email" usually means the user already exists. Look in the `user` table before suspecting the sign-up code.
- Deleting a user cascades to all of its data (every FK to `user` is ON DELETE CASCADE). The demo users are recreated by `pnpm db:seed` / `db:seed:scenarios`.
