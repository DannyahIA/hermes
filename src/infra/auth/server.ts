import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { headers } from 'next/headers';

import { env } from '@/config/env';
import { db } from '@/infra/database';
import * as schema from '@/infra/database/schema';

export const auth = betterAuth({
  database: drizzleAdapter(db as never, {
    provider: 'pg',
    schema,
    usePlural: false,
  }),
  baseURL: env.DATABASE_URL.includes('supabase')
    ? 'http://localhost:3000'
    : 'http://localhost:3000',
  secret: process.env.BETTER_AUTH_SECRET ?? 'development-secret',
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    },
  },
  plugins: [],
});

export const authHandlers = async () => {
  const requestHeaders = await headers();
  return auth.api.getSession({ headers: requestHeaders });
};
