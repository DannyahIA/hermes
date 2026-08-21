import { headers } from 'next/headers';

import { ROUTES } from '@/config/routes';
import type {
  AuthProvider,
  SignInInput,
  SignUpInput,
} from '@/core/contracts/auth-provider';
import { DomainError } from '@/core/errors/domain-error';
import { auth } from '@/infra/auth/server';

function toDomainError(error: unknown): DomainError {
  if (error instanceof Error) {
    return new DomainError(error.message, 'AUTH_ERROR');
  }
  return new DomainError('Authentication failed.', 'AUTH_ERROR');
}

/**
 * Translates the `AuthProvider` contract into calls against better-auth's
 * server API. This is the only file in the codebase allowed to import
 * `better-auth` directly for these operations.
 */
export class BetterAuthProvider implements AuthProvider {
  async signUp(input: SignUpInput): Promise<{ userId: string }> {
    try {
      const result = await auth.api.signUpEmail({
        body: input,
        headers: await headers(),
      });
      return { userId: result.user.id };
    } catch (error) {
      throw toDomainError(error);
    }
  }

  async signIn(input: SignInInput): Promise<void> {
    try {
      await auth.api.signInEmail({
        body: input,
        headers: await headers(),
      });
    } catch (error) {
      throw toDomainError(error);
    }
  }

  async signOut(): Promise<void> {
    try {
      await auth.api.signOut({ headers: await headers() });
    } catch (error) {
      throw toDomainError(error);
    }
  }

  async requestPasswordReset(email: string): Promise<void> {
    try {
      await auth.api.requestPasswordReset({
        body: { email, redirectTo: ROUTES.login },
      });
    } catch (error) {
      throw toDomainError(error);
    }
  }

  async resendVerificationEmail(email: string): Promise<void> {
    try {
      await auth.api.sendVerificationEmail({ body: { email } });
    } catch (error) {
      throw toDomainError(error);
    }
  }
}
