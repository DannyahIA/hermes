---
title: How the user runs and reaches Hermes
author: DannyahIA
date: 2026-10-23
id: l-4606c8aa
scope: repo
status: active
touches:
  - next.config.ts
---

## Decided

The user runs Hermes with `pnpm dev` (`next dev`, port 3000) from ~/Projects/hermes and opens it from other devices by the machine's LAN IP, which changes with the network: 192.168.100.201 at one place, 10.55.66.192 (wlo1) on 2026-10-19. The old domain (hermes.eclipsiasoftware.com) expired. Since 2026-10-19 the canonical address is Tailscale: https://homelab.tail46c11a.ts.net (`tailscale serve --bg 3000`, tailnet only, operator = dan, so no sudo is needed). NEXT_PUBLIC_APP_URL points there. The .ts.net name never resolved on the user's iPhone (no connection reached :443), so the shortcut uses the Tailscale IP: CAPTURE_BASE_URL=http://100.126.235.31:3000. The user will revisit this when the app is published. .env.local.pre-tailscale.bak keeps the old values. Logging in by a LAN IP no longer works (untrusted origin, Secure cookies).

**Why:** three things are tied to the address: `allowedDevOrigins` (blocked scripts make every page unclickable), and `NEXT_PUBLIC_APP_URL`, which drives the auth redirects, better-auth's trustedOrigins and the auth client's baseURL. On 2026-10-19 next.config.ts was changed to allow the machine's own IPs automatically. NEXT_PUBLIC_APP_URL still pins a single address.

## Watch out

when "nothing is clickable" or "login fails" comes up from a non-localhost address, first compare the current IP (`ip -4 addr`) with NEXT_PUBLIC_APP_URL and NEXT_DEV_ALLOWED_ORIGINS in .env.local. The dev server is the user's live instance, so don't restart it or run builds that disturb it without saying so.

_From Claude Code's memory of this repo, last updated Oct 19._
