import { getSessionCookie } from 'better-auth/cookies';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { GUEST_ONLY_ROUTES, PROTECTED_ROUTES, ROUTES } from '@/config/routes';

// Read directly from `process.env` (not `@/config/env`'s validated `env`
// export) — that module calls `process.loadEnvFile`, a Node-only API this
// middleware can't rely on if it ever runs on the Edge runtime. Next.js
// inlines `NEXT_PUBLIC_*` vars into the bundle at build time regardless of
// runtime, so this read is safe either way.
//
// Redirects are built from this instead of the request's own URL/Host: this
// app sits behind a Cloudflare tunnel that doesn't forward the public
// hostname to the origin, so `request.url` here resolves to the tunnel's
// internal address (e.g. localhost) — a redirect built from it would send a
// phone straight to an address it can never reach.
const PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL;

/**
 * Optimistic route guard: checks only for the *presence* of a session
 * cookie (no database hit), so it's cheap enough to run on every request.
 * This is not a full authorization check — a forged/expired cookie would
 * pass here — so every protected Server Component/action must still call
 * `getCurrentSession` (see `infra/auth/session.ts`) before trusting the
 * user is signed in.
 */
export function authMiddleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(getSessionCookie(request));

  const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route),
  );
  const isGuestOnlyRoute = GUEST_ONLY_ROUTES.some((route) =>
    pathname.startsWith(route),
  );

  if (isProtectedRoute && !hasSessionCookie) {
    const loginUrl = new URL(ROUTES.login, PUBLIC_APP_URL ?? request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isGuestOnlyRoute && hasSessionCookie) {
    return NextResponse.redirect(
      new URL(ROUTES.dashboard, PUBLIC_APP_URL ?? request.url),
    );
  }

  return NextResponse.next();
}
