import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { env } from '@/config/env';
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
export async function GET() {
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch {
    // The cookie may already be gone or the session already invalid server
    // side — either way there's nothing left to clean up, and the visitor
    // still needs to land on the login page.
  }

  // Deliberately built from NEXT_PUBLIC_APP_URL, not the incoming request's
  // own URL/Host header: this app sits behind a Cloudflare tunnel that
  // doesn't forward the public hostname to the origin, so `request.url`
  // here resolves to the tunnel's internal address (e.g. localhost) — a
  // redirect built from it sends a phone straight to an address it can
  // never reach. NEXT_PUBLIC_APP_URL is the one place that's configured to
  // be the actual public address, so it's the only source trusted here.
  return NextResponse.redirect(new URL(ROUTES.login, env.NEXT_PUBLIC_APP_URL));
}
