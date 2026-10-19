'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { ROUTES } from '@/config/routes';
import { DomainError } from '@/core/errors/domain-error';
import { requireCurrentUserId } from '@/infra/auth/session';
import { withTransaction } from '@/infra/database/transaction';
import { DrizzleApiTokenRepository } from '@/infra/repositories/drizzle-api-token.repository';
import {
  CreateCaptureTokenUseCase,
  RevokeCaptureTokenUseCase,
} from '@/modules/capture/application/capture-tokens.use-case';
import {
  DiscardCaptureUseCase,
  ProvideCaptureAmountUseCase,
  ResolveWalletCardUseCase,
} from '@/modules/capture/application/capture-wallet-payment.use-case';
import { captureDependencies } from '@/shared/server/capture-dependencies';
import { revalidateMoneyPages } from '@/shared/server/revalidate-money-pages';

export type SettingsResult<T = object> =
  ({ success: true } & T) | { success: false; error: string };

const FAILED = 'Não foi possível salvar. Tente novamente.';

function failure(error: unknown): { success: false; error: string } {
  if (error instanceof DomainError && error.code === 'ACCOUNT_ARCHIVED') {
    return {
      success: false,
      error: 'Essa conta foi arquivada. Escolha outra.',
    };
  }
  return { success: false, error: FAILED };
}

/** A new token for the iPhone shortcut; it is shown once, from this answer. */
export async function createCaptureTokenAction(
  name: string,
): Promise<SettingsResult<{ token: string }>> {
  try {
    const userId = await requireCurrentUserId();
    const { token } = await new CreateCaptureTokenUseCase(
      new DrizzleApiTokenRepository(),
    ).execute({ userId, name: String(name ?? '') });
    revalidatePath(ROUTES.settings);
    return { success: true, token };
  } catch (error) {
    return failure(error);
  }
}

export async function revokeCaptureTokenAction(
  tokenId: string,
): Promise<SettingsResult> {
  const parsed = z.uuid().safeParse(tokenId);
  if (!parsed.success) return { success: false, error: FAILED };
  try {
    const userId = await requireCurrentUserId();
    await new RevokeCaptureTokenUseCase(
      new DrizzleApiTokenRepository(),
    ).execute({ userId, tokenId: parsed.data });
    revalidatePath(ROUTES.settings);
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}

const assignSchema = z.object({
  walletCardId: z.uuid(),
  accountId: z.uuid(),
  alternateAccountId: z
    .uuid()
    .nullish()
    .transform((value) => value ?? undefined),
});

/**
 * Says where a Wallet card's payments go, and records the ones that were
 * waiting for it.
 */
export async function assignWalletCardAction(
  input: z.input<typeof assignSchema>,
): Promise<SettingsResult<{ recorded: number }>> {
  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Escolha uma conta.' };
  try {
    const userId = await requireCurrentUserId();
    const recorded = await withTransaction((tx) =>
      new ResolveWalletCardUseCase(captureDependencies(tx)).execute({
        userId,
        ...parsed.data,
      }),
    );
    revalidatePath(ROUTES.settings);
    if (recorded > 0) revalidateMoneyPages();
    return { success: true, recorded };
  } catch (error) {
    return failure(error);
  }
}

const amountSchema = z.object({
  captureId: z.uuid(),
  amount: z.coerce
    .number({ message: 'Informe o valor.' })
    .positive('Informe um valor maior que zero.')
    .max(9_999_999_999.99, 'O valor é alto demais.')
    .transform((value) => Math.round(value * 100) / 100),
});

/** The amount of a payment that arrived without one; then it is recorded. */
export async function provideCaptureAmountAction(
  input: z.input<typeof amountSchema>,
): Promise<SettingsResult<{ recorded: boolean }>> {
  const parsed = amountSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Informe o valor.',
    };
  }
  try {
    const userId = await requireCurrentUserId();
    const result = await withTransaction((tx) =>
      new ProvideCaptureAmountUseCase(captureDependencies(tx)).execute({
        userId,
        ...parsed.data,
      }),
    );
    revalidatePath(ROUTES.settings);
    if (result.status === 'recorded') revalidateMoneyPages();
    return { success: true, recorded: result.status === 'recorded' };
  } catch (error) {
    return failure(error);
  }
}

export async function discardCaptureAction(
  captureId: string,
): Promise<SettingsResult> {
  const parsed = z.uuid().safeParse(captureId);
  if (!parsed.success) return { success: false, error: FAILED };
  try {
    const userId = await requireCurrentUserId();
    await withTransaction((tx) =>
      new DiscardCaptureUseCase(captureDependencies(tx)).execute({
        userId,
        captureId: parsed.data,
      }),
    );
    revalidatePath(ROUTES.settings);
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}
