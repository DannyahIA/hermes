import { createAuthClient } from 'better-auth/react';

// Deliberately reads `process.env` directly instead of `@/config/env`: this
// module is bundled into the browser, where only `NEXT_PUBLIC_*` variables
// exist — importing the full server-validated `env` object would throw in
// the browser bundle.
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
});

export const { signIn, signUp, signOut, useSession } = authClient;
