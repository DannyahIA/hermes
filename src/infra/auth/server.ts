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
