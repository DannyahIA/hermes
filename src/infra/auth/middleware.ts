import { getSessionCookie } from 'better-auth/cookies';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { GUEST_ONLY_ROUTES, PROTECTED_ROUTES, ROUTES } from '@/config/routes';

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
    const loginUrl = new URL(ROUTES.login, request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isGuestOnlyRoute && hasSessionCookie) {
    return NextResponse.redirect(new URL(ROUTES.dashboard, request.url));
  }

  return NextResponse.next();
}
