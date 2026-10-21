'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { z } from 'zod';

import { getTelegramBot } from '@/config/env';
import { ROUTES } from '@/config/routes';
import { DomainError } from '@/core/errors/domain-error';
import { requireCurrentUserId } from '@/infra/auth/session';
import { withTransaction } from '@/infra/database/transaction';
import { DrizzleApiTokenRepository } from '@/infra/repositories/drizzle-api-token.repository';
import { DrizzleCategoryRepository } from '@/infra/repositories/drizzle-category.repository';
import { DrizzleChatLinkRepository } from '@/infra/repositories/drizzle-chat-link.repository';
import { DrizzleMerchantRuleRepository } from '@/infra/repositories/drizzle-merchant-rule.repository';
import { DrizzleViewPreferenceRepository } from '@/infra/repositories/drizzle-view-preference.repository';
import {
  CreateCaptureTokenUseCase,
  RevokeCaptureTokenUseCase,
} from '@/modules/capture/application/capture-tokens.use-case';
import {
  DiscardCaptureUseCase,
  ProvideCaptureAmountUseCase,
  ResolveWalletCardUseCase,
} from '@/modules/capture/application/capture-wallet-payment.use-case';
import {
  CreateChatLinkCodeUseCase,
  UnlinkChatUseCase,
} from '@/modules/capture/application/chat-links.use-case';
import { SetChatPrivacyUseCase } from '@/modules/capture/application/chat-privacy.use-case';
import {
  ChangeMerchantRuleCategoryUseCase,
  ForgetMerchantRuleUseCase,
} from '@/modules/categories/application/merchant-rules.use-case';
import { captureDependencies } from '@/shared/server/capture-dependencies';
import { announceCaptures } from '@/shared/server/chat';
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
  if (error instanceof DomainError && error.code === 'CATEGORY_ARCHIVED') {
    return {
      success: false,
      error: 'Essa categoria foi arquivada. Escolha outra.',
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
    if (recorded.length > 0) revalidateMoneyPages();
    after(() => announceCaptures(userId, recorded));
    return { success: true, recorded: recorded.length };
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
    after(() => announceCaptures(userId, [result.captureId]));
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
    after(() => announceCaptures(userId, [parsed.data]));
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}

/**
 * The "Abrir no Telegram" link: starts the bot with a one-time code that
 * connects whoever taps "Começar" to this account (spec 2026-10-17-
 * telegram-apple-pay-design.md §5.1).
 */
export async function connectTelegramAction(): Promise<
  SettingsResult<{ url: string; expiresAt: string }>
> {
  const bot = getTelegramBot();
  if (!bot)
    return { success: false, error: 'O bot do Telegram não está configurado.' };
  try {
    const userId = await requireCurrentUserId();
    const { code, expiresAt } = await new CreateChatLinkCodeUseCase(
      new DrizzleChatLinkRepository(),
    ).execute({ userId });
    return {
      success: true,
      url: `https://t.me/${bot.username}?start=${code}`,
      expiresAt: expiresAt.toISOString(),
    };
  } catch (error) {
    return failure(error);
  }
}

export async function disconnectTelegramAction(): Promise<SettingsResult> {
  try {
    const userId = await requireCurrentUserId();
    await new UnlinkChatUseCase(new DrizzleChatLinkRepository()).execute({
      userId,
    });
    revalidatePath(ROUTES.settings);
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}

/** Whether payment messages in Telegram say what is still free to spend. */
export async function setTelegramPrivacyAction(
  showFree: boolean,
): Promise<SettingsResult> {
  const parsed = z.boolean().safeParse(showFree);
  if (!parsed.success) return { success: false, error: FAILED };
  try {
    const userId = await requireCurrentUserId();
    await new SetChatPrivacyUseCase(
      new DrizzleViewPreferenceRepository(),
    ).execute({ userId, showFree: parsed.data });
    revalidatePath(ROUTES.settings);
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}

const ruleCategorySchema = z.object({ ruleId: z.uuid(), categoryId: z.uuid() });

/** The category a remembered merchant's next payments go to. */
export async function changeMerchantRuleCategoryAction(
  input: z.input<typeof ruleCategorySchema>,
): Promise<SettingsResult> {
  const parsed = ruleCategorySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: FAILED };
  try {
    const userId = await requireCurrentUserId();
    await new ChangeMerchantRuleCategoryUseCase(
      new DrizzleMerchantRuleRepository(),
      new DrizzleCategoryRepository(),
    ).execute({ userId, ...parsed.data });
    revalidatePath(ROUTES.settings);
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}

export async function forgetMerchantRuleAction(
  ruleId: string,
): Promise<SettingsResult> {
  const parsed = z.uuid().safeParse(ruleId);
  if (!parsed.success) return { success: false, error: FAILED };
  try {
    const userId = await requireCurrentUserId();
    await new ForgetMerchantRuleUseCase(
      new DrizzleMerchantRuleRepository(),
    ).execute({ userId, ruleId: parsed.data });
    revalidatePath(ROUTES.settings);
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}
