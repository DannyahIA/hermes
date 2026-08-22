import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { ROUTES } from '@/config/routes';
import { auth } from '@/infra/auth/server';

/**
 * The authoritative session check for Server Components/actions — hits the
 * database via better-auth. `cache()` de-dupes repeated calls within a
 * single request/render pass. Middleware only does a cheap cookie-presence
 * check (see `infra/auth/middleware.ts`); this is what pages must call
 * before trusting a user is signed in.
 */
export const getCurrentSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export async function getCurrentUserId(): Promise<string | null> {
  const session = await getCurrentSession();
  return session?.user.id ?? null;
}

/**
 * The authoritative check every protected Server Component/action must
 * call. Middleware's cookie-presence check (`infra/auth/middleware.ts`) is
 * only optimistic — a cookie can be present but expired, revoked, or
 * otherwise fail the real database-backed lookup (e.g. right after a
 * baseURL/cookie-config change invalidates old sessions). That gap used to
 * surface here as an unhandled `throw`, which Next.js rendered as a raw
 * "Runtime Error" page instead of sending the visitor to sign in again —
 * `redirect()` is the graceful equivalent middleware already uses.
 */
export async function requireCurrentUserId(): Promise<string> {
  const userId = await getCurrentUserId();

  if (!userId) {
    redirect(ROUTES.login);
  }

  return userId;
}
