'use server';

import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { DomainError } from '@/core/errors/domain-error';
import { requireCurrentUserId } from '@/infra/auth/session';
import { withTransaction } from '@/infra/database/transaction';
import { DrizzleAccountRepository } from '@/infra/repositories/drizzle-account.repository';
import { DrizzleCategoryRepository } from '@/infra/repositories/drizzle-category.repository';
import { DrizzleMerchantRuleRepository } from '@/infra/repositories/drizzle-merchant-rule.repository';
import { DrizzleTransactionRepository } from '@/infra/repositories/drizzle-transaction.repository';
import { RecordQuickEntryUseCase } from '@/modules/capture/application/record-quick-entry.use-case';
import {
  type RecordQuickEntrySchema,
  recordQuickEntrySchema,
} from '@/modules/capture/schemas/record-quick-entry.schema';
import { CategorizeTransactionUseCase } from '@/modules/transactions/application/categorize-transaction.use-case';
import { revalidateMoneyPages } from '@/shared/server/revalidate-money-pages';

export interface CategorizeResult {
  success: boolean;
  error?: string;
}

const categorizeSchema = z.object({
  transactionId: z.uuid(),
  categoryId: z.uuid(),
});

const FAILED = 'Não foi possível salvar a categoria. Tente novamente.';
const ARCHIVED = 'Essa categoria foi arquivada. Escolha outra.';

/**
 * One tap in "Para revisar" (or on "Sem categoria" in the latest
 * transactions): files the transaction and remembers the category for its
 * merchant.
 */
export async function categorizeTransactionAction(
  transactionId: string,
  categoryId: string,
): Promise<CategorizeResult> {
  const parsed = categorizeSchema.safeParse({ transactionId, categoryId });
  if (!parsed.success) return { success: false, error: FAILED };

  try {
    const userId = await requireCurrentUserId();
    await withTransaction(async (tx) => {
      await new CategorizeTransactionUseCase(
        new DrizzleTransactionRepository(tx),
        new DrizzleAccountRepository(tx),
        new DrizzleCategoryRepository(tx),
        new DrizzleMerchantRuleRepository(tx),
      ).execute({ userId, ...parsed.data });
    });
  } catch (error) {
    if (error instanceof DomainError && error.code === 'CATEGORY_ARCHIVED') {
      return { success: false, error: ARCHIVED };
    }
    return { success: false, error: FAILED };
  }

  revalidateMoneyPages();
  return { success: true };
}

export type RecordQuickEntryResult =
  { success: true; transactionId: string } | { success: false; error: string };

const NOT_RECORDED = 'Não foi possível registrar. Tente novamente.';

/**
 * Enter in the quick entry: records the line as it was understood
 * (`parseQuickEntry`, in the browser) and remembers its category for the
 * merchant. Returns the new transaction's id so the toast can undo it.
 */
export async function recordQuickEntryAction(
  entry: RecordQuickEntrySchema,
): Promise<RecordQuickEntryResult> {
  const parsed = recordQuickEntrySchema.safeParse(entry);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? NOT_RECORDED,
    };
  }

  const transactionId = randomUUID();
  try {
    const userId = await requireCurrentUserId();
    await withTransaction(async (tx) => {
      await new RecordQuickEntryUseCase(
        new DrizzleTransactionRepository(tx),
        new DrizzleAccountRepository(tx),
        new DrizzleCategoryRepository(tx),
        new DrizzleMerchantRuleRepository(tx),
      ).execute({ id: transactionId, userId, ...parsed.data });
    });
  } catch (error) {
    if (error instanceof DomainError && error.code === 'CATEGORY_ARCHIVED') {
      return { success: false, error: ARCHIVED };
    }
    return { success: false, error: NOT_RECORDED };
  }

  revalidateMoneyPages();
  return { success: true, transactionId };
}
