'use server';

import { randomUUID } from 'node:crypto';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/routes';
import { DomainError } from '@/core/errors/domain-error';
import { requireCurrentUserId } from '@/infra/auth/session';
import { withTransaction } from '@/infra/database/transaction';
import { DrizzleAccountRepository } from '@/infra/repositories/drizzle-account.repository';
import { DrizzleCategoryRepository } from '@/infra/repositories/drizzle-category.repository';
import { DrizzleInstallmentPlanRepository } from '@/infra/repositories/drizzle-installment-plan.repository';
import { DrizzleTransactionRepository } from '@/infra/repositories/drizzle-transaction.repository';
import { DeleteInstallmentPlanUseCase } from '@/modules/installments/application/delete-installment-plan.use-case';
import { CreateLoanUseCase } from '@/modules/loans/application/create-loan.use-case';
import { createLoanSchema } from '@/modules/loans/schemas/create-loan.schema';

export interface ActionResult {
  success: boolean;
  error?: string;
}

function toUserMessage(error: unknown): string {
  if (error instanceof DomainError) {
    return error.message;
  }
  return 'Não foi possível concluir esta ação. Tente novamente.';
}

function revalidateLoanPages() {
  revalidatePath(ROUTES.loans);
  revalidatePath(ROUTES.dashboard);
  revalidatePath(ROUTES.accounts);
  revalidatePath(ROUTES.transactions);
}

export async function createLoanAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = createLoanSchema.safeParse({
    description: formData.get('description'),
    principal: formData.get('principal'),
    monthlyInterestRate: formData.get('monthlyInterestRate'),
    installmentCount: formData.get('installmentCount'),
    disbursementAccountId: formData.get('disbursementAccountId'),
    repaymentAccountId: formData.get('repaymentAccountId'),
    startDate: formData.get('startDate') || undefined,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
    };
  }

  try {
    const userId = await requireCurrentUserId();

    await withTransaction(async (tx) => {
      const useCase = new CreateLoanUseCase(
        new DrizzleInstallmentPlanRepository(tx),
        new DrizzleTransactionRepository(tx),
        new DrizzleAccountRepository(tx),
        new DrizzleCategoryRepository(tx),
      );
      await useCase.execute({
        id: randomUUID(),
        userId,
        ...parsed.data,
      });
    });

    revalidateLoanPages();
    return { success: true };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function deleteLoanAction(id: string): Promise<ActionResult> {
  try {
    const userId = await requireCurrentUserId();

    await withTransaction(async (tx) => {
      const useCase = new DeleteInstallmentPlanUseCase(
        new DrizzleInstallmentPlanRepository(tx),
        new DrizzleTransactionRepository(tx),
        new DrizzleAccountRepository(tx),
      );
      await useCase.execute({ id, userId });
    });

    revalidateLoanPages();
    return { success: true };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}
