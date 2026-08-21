'use server';

import { randomUUID } from 'node:crypto';

import { revalidatePath } from 'next/cache';

import type { ActionResult } from '@/app/transactions/actions';
import { ROUTES } from '@/config/routes';
import { DomainError } from '@/core/errors/domain-error';
import { requireCurrentUserId } from '@/infra/auth/session';
import { DrizzleAccountRepository } from '@/infra/repositories/drizzle-account.repository';
import { DrizzleCategoryRepository } from '@/infra/repositories/drizzle-category.repository';
import { DrizzleRecurringTransactionRepository } from '@/infra/repositories/drizzle-recurring-transaction.repository';
import { CreateRecurringTransactionUseCase } from '@/modules/recurring-transactions/application/create-recurring-transaction.use-case';
import { DeleteRecurringTransactionUseCase } from '@/modules/recurring-transactions/application/delete-recurring-transaction.use-case';
import { UpdateRecurringTransactionUseCase } from '@/modules/recurring-transactions/application/update-recurring-transaction.use-case';
import { createRecurringTransactionSchema } from '@/modules/recurring-transactions/schemas/create-recurring-transaction.schema';
import { updateRecurringTransactionSchema } from '@/modules/recurring-transactions/schemas/update-recurring-transaction.schema';

function toUserMessage(error: unknown): string {
  if (error instanceof DomainError) {
    return error.message;
  }
  return 'Não foi possível concluir esta ação. Tente novamente.';
}

export async function createRecurringTransactionAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = createRecurringTransactionSchema.safeParse({
    accountId: formData.get('accountId'),
    categoryId: formData.get('categoryId'),
    description: formData.get('description'),
    amount: formData.get('amount'),
    type: formData.get('type'),
    dayRuleKind: formData.get('dayRuleKind'),
    dayRuleDay: formData.get('dayRuleDay') || undefined,
    startDate: formData.get('startDate') || undefined,
    endDate: formData.get('endDate') || undefined,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
    };
  }

  try {
    const userId = await requireCurrentUserId();
    const useCase = new CreateRecurringTransactionUseCase(
      new DrizzleRecurringTransactionRepository(),
      new DrizzleAccountRepository(),
      new DrizzleCategoryRepository(),
    );
    await useCase.execute({
      id: randomUUID(),
      userId,
      startDate: parsed.data.startDate ?? new Date(),
      ...parsed.data,
    });

    revalidatePath(ROUTES.transactions);
    return { success: true };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function updateRecurringTransactionAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = updateRecurringTransactionSchema.safeParse({
    id: formData.get('id'),
    description: formData.get('description'),
    amount: formData.get('amount') || undefined,
    categoryId: formData.get('categoryId'),
    dayRuleKind: formData.get('dayRuleKind') || undefined,
    dayRuleDay: formData.get('dayRuleDay') || undefined,
    active: formData.get('active') === 'on',
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
    };
  }

  try {
    const userId = await requireCurrentUserId();
    const useCase = new UpdateRecurringTransactionUseCase(
      new DrizzleRecurringTransactionRepository(),
    );
    await useCase.execute({ userId, ...parsed.data });

    revalidatePath(ROUTES.transactions);
    return { success: true };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function toggleRecurringTransactionActiveAction(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  try {
    const userId = await requireCurrentUserId();
    const useCase = new UpdateRecurringTransactionUseCase(
      new DrizzleRecurringTransactionRepository(),
    );
    await useCase.execute({ id, userId, active });

    revalidatePath(ROUTES.transactions);
    return { success: true };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function deleteRecurringTransactionAction(
  id: string,
): Promise<ActionResult> {
  try {
    const userId = await requireCurrentUserId();
    const useCase = new DeleteRecurringTransactionUseCase(
      new DrizzleRecurringTransactionRepository(),
    );
    await useCase.execute({ id, userId });

    revalidatePath(ROUTES.transactions);
    return { success: true };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}
