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
