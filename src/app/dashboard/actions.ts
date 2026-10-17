'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { ROUTES } from '@/config/routes';
import { DomainError } from '@/core/errors/domain-error';
import { requireCurrentUserId } from '@/infra/auth/session';
import { withTransaction } from '@/infra/database/transaction';
import { DrizzleAccountRepository } from '@/infra/repositories/drizzle-account.repository';
import { DrizzleCategoryRepository } from '@/infra/repositories/drizzle-category.repository';
import { DrizzleMerchantRuleRepository } from '@/infra/repositories/drizzle-merchant-rule.repository';
import { DrizzleTransactionRepository } from '@/infra/repositories/drizzle-transaction.repository';
import { CategorizeTransactionUseCase } from '@/modules/transactions/application/categorize-transaction.use-case';

export interface CategorizeResult {
  success: boolean;
  error?: string;
}

const categorizeSchema = z.object({
  transactionId: z.uuid(),
  categoryId: z.uuid(),
});

const FAILED = 'Não foi possível salvar a categoria. Tente novamente.';

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
      return {
        success: false,
        error: 'Essa categoria foi arquivada. Escolha outra.',
      };
    }
    return { success: false, error: FAILED };
  }

  revalidatePath(ROUTES.dashboard);
  revalidatePath(ROUTES.transactions);
  revalidatePath(ROUTES.budgets);
  revalidatePath(ROUTES.reports);
  return { success: true };
}
