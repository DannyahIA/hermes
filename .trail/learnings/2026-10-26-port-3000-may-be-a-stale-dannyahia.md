---
title: 'Port 3000 may be a stale next start, not the dev server'
author: DannyahIA
date: 2026-10-26
branch: feat/meu-dinheiro-categorias
cost: { minutes: 1, tokens: 996 }
id: l-400568eb
scope: repo
status: active
src: agent
touches:
  - package.json
  - next.config.ts
---

## Watch out

- The next-server on port 3000 is not always `pnpm dev` (package.json): on 2026-10-26 it was an orphaned `next start` (production build, parent systemd --user), so working-tree changes never showed up. Check NODE_ENV in /proc/<pid>/environ before assuming the live server reflects the code.
- To switch, kill only that PID (never pkill next-server; the auto-mode classifier blocks it) and start `pnpm dev` detached with setsid/nohup. It must stay on port 3000 because NEXT_PUBLIC_APP_URL (.env.local) and next.config.ts allowedDevOrigins point there.
