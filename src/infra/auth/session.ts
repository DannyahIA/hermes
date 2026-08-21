import { headers } from 'next/headers';
import { cache } from 'react';

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

export async function requireCurrentUserId(): Promise<string> {
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error('No authenticated user in context.');
  }

  return userId;
}
