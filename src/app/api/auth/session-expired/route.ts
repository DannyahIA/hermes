import { headers } from 'next/headers';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { ROUTES } from '@/config/routes';
import { auth } from '@/infra/auth/server';

/**
 * Where `requireCurrentUserId` (`infra/auth/session.ts`) sends a request
 * whose session cookie exists but fails the real database-backed check
 * (expired, revoked, or left over from a since-changed cookie config).
 *
 * This can't be done directly from the Server Component that discovered the
 * problem — Next.js only allows mutating cookies from a Server Action or a
 * Route Handler, never from a page's render. And it can't simply redirect
 * to `/login` either: `authMiddleware` only checks whether a session cookie
 * is *present*, not whether it's valid, so a stale-but-present cookie makes
 * it bounce every `/login` visit straight back to a protected page — which
 * fails the same check and redirects here again, forever. Actually clearing
 * the cookie (via the same `auth.api.signOut` the "Sair" button uses)
 * before redirecting is what breaks that loop.
 */
export async function GET(request: NextRequest) {
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch {
    // The cookie may already be gone or the session already invalid server
    // side — either way there's nothing left to clean up, and the visitor
    // still needs to land on the login page.
  }

  // Built from the incoming request rather than NEXT_PUBLIC_APP_URL: this
  // route must redirect correctly no matter which trusted origin the
  // request actually arrived on (see the `trustedOrigins` note in
  // `infra/auth/server.ts` — this app is legitimately reached from more
  // than one).
  return NextResponse.redirect(new URL(ROUTES.login, request.url));
}
