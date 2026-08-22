import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';

import {
  env,
  isGithubAuthConfigured,
  isGoogleAuthConfigured,
} from '@/config/env';
import { db } from '@/infra/database/client';
import * as schema from '@/infra/database/schema';
import { ResendEmailSender } from '@/infra/email/resend-email-sender.adapter';
import {
  resetPasswordEmailTemplate,
  verificationEmailTemplate,
} from '@/infra/email/templates';

const emailSender = new ResendEmailSender();

/**
 * Server-side better-auth instance — the single owner of credentials,
 * sessions and social sign-in. Never imported from client components; see
 * `infra/auth/client.ts` for the browser-side counterpart.
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
    usePlural: false,
  }),
  baseURL: env.NEXT_PUBLIC_APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  session: {
    // Short by design: a signed-out-after-a-day session matters more here
    // than never re-typing a password, since this is a personal-finance
    // app that may be opened on a shared or easily-lost device (a phone).
    expiresIn: 60 * 60 * 24, // 1 day
    // Any request within this window of expiry silently extends it — so a
    // session in daily use never actually expires; only a day of *no* use
    // does. Kept well under `expiresIn` so activity has room to extend it.
    updateAge: 60 * 60 * 6, // 6 hours
    cookieCache: {
      // A short-lived signed cookie caches the session's validity/expiry,
      // checked entirely from the cookie's signature — no database round
      // trip. This is what closes the gap `authMiddleware` always had: its
      // cookie-*presence* check couldn't tell a live session from a stale
      // one, which is exactly what produced 2026-08-22's login/dashboard
      // redirect loop. `maxAge` bounds how stale that cached copy can get —
      // e.g. a session revoked by a password change elsewhere is still
      // honored for up to this long before the next real database check.
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },
  // better-auth rejects any state-changing request (POST/PUT/DELETE — every
  // sign-in, sign-out, and mutating action in this app) whose Origin header
  // isn't in this list, defaulting to just `[baseURL]`. This app is reached
  // from more than one origin in practice (localhost during local dev, plus
  // whatever `NEXT_PUBLIC_APP_URL` is set to for real access, e.g. a domain
  // in front of a tunnel) — every origin that's actually used to reach this
  // server must be listed here, or every button behind a server action
  // silently 403s from that origin with no visible error on the client.
  trustedOrigins: Array.from(
    new Set(['http://localhost:3000', env.NEXT_PUBLIC_APP_URL]),
  ),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // A session before the email is confirmed would be misleading — the
    // user lands on /verify-email instead (see app/(auth)/actions.ts).
    autoSignIn: false,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      const { subject, html } = resetPasswordEmailTemplate(url);
      await emailSender.send({ to: user.email, subject, html });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      const { subject, html } = verificationEmailTemplate(url);
      await emailSender.send({ to: user.email, subject, html });
    },
  },
  // Each social provider is optional and only registered when both of its
  // credentials are present in the environment — the primary flow stays
  // email/password.
  socialProviders: {
    ...(isGithubAuthConfigured() && {
      github: {
        clientId: env.GITHUB_CLIENT_ID as string,
        clientSecret: env.GITHUB_CLIENT_SECRET as string,
      },
    }),
    ...(isGoogleAuthConfigured() && {
      google: {
        clientId: env.GOOGLE_CLIENT_ID as string,
        clientSecret: env.GOOGLE_CLIENT_SECRET as string,
      },
    }),
  },
  // Must be the last plugin: makes auth.api.* calls from server actions set
  // cookies on the response automatically.
  plugins: [nextCookies()],
});

export type Auth = typeof auth;
