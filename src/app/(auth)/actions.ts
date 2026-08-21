'use server';

import { redirect } from 'next/navigation';

import { ROUTES } from '@/config/routes';
import { DomainError } from '@/core/errors/domain-error';
import { BetterAuthProvider } from '@/infra/auth/better-auth-provider.adapter';
import { RequestPasswordResetUseCase } from '@/modules/auth/application/request-password-reset.use-case';
import { ResendVerificationEmailUseCase } from '@/modules/auth/application/resend-verification-email.use-case';
import { SignInUseCase } from '@/modules/auth/application/sign-in.use-case';
import { SignOutUseCase } from '@/modules/auth/application/sign-out.use-case';
import { SignUpUseCase } from '@/modules/auth/application/sign-up.use-case';
import { forgotPasswordSchema } from '@/modules/auth/schemas/forgot-password.schema';
import { signInSchema } from '@/modules/auth/schemas/sign-in.schema';
import { signUpSchema } from '@/modules/auth/schemas/sign-up.schema';

export interface AuthActionState {
  success: boolean;
  error?: string;
  values?: Record<string, string>;
}

function toUserMessage(error: unknown): string {
  if (error instanceof DomainError) {
    return error.message;
  }
  return 'Não foi possível concluir esta ação. Tente novamente.';
}

export async function signUpAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const raw = {
    name: String(formData.get('name') ?? ''),
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  };

  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
      values: { name: raw.name, email: raw.email },
    };
  }

  try {
    const useCase = new SignUpUseCase(new BetterAuthProvider());
    await useCase.execute(parsed.data);
  } catch (error) {
    return {
      success: false,
      error: toUserMessage(error),
      values: { name: raw.name, email: raw.email },
    };
  }

  // No session is created yet — email verification is required before
  // sign-in (see infra/auth/server.ts). The confirmation link is what
  // signs the user in (autoSignInAfterVerification).
  redirect(
    `${ROUTES.verifyEmail}?email=${encodeURIComponent(parsed.data.email)}`,
  );
}

export async function signInAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const raw = {
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  };
  const redirectTo = String(formData.get('redirectTo') ?? ROUTES.dashboard);

  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
      values: { email: raw.email },
    };
  }

  try {
    const useCase = new SignInUseCase(new BetterAuthProvider());
    await useCase.execute(parsed.data);
  } catch (error) {
    if (
      error instanceof DomainError &&
      error.message === 'Email not verified'
    ) {
      redirect(`${ROUTES.verifyEmail}?email=${encodeURIComponent(raw.email)}`);
    }

    // Never reveal whether the email exists or the password was wrong.
    return {
      success: false,
      error: 'E-mail ou senha incorretos.',
      values: { email: raw.email },
    };
  }

  redirect(redirectTo || ROUTES.dashboard);
}

export async function signOutAction(): Promise<void> {
  const useCase = new SignOutUseCase(new BetterAuthProvider());
  await useCase.execute();
  redirect(ROUTES.login);
}

export async function requestPasswordResetAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const raw = { email: String(formData.get('email') ?? '') };
  const parsed = forgotPasswordSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
      values: raw,
    };
  }

  try {
    const useCase = new RequestPasswordResetUseCase(new BetterAuthProvider());
    await useCase.execute(parsed.data.email);
  } catch (error) {
    return { success: false, error: toUserMessage(error), values: raw };
  }

  return { success: true };
}

export async function resendVerificationEmailAction(
  email: string,
): Promise<AuthActionState> {
  try {
    const useCase = new ResendVerificationEmailUseCase(
      new BetterAuthProvider(),
    );
    await useCase.execute(email);
    return { success: true };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}
