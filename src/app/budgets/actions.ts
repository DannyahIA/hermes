'use server';

import { randomUUID } from 'node:crypto';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/routes';
import { DomainError } from '@/core/errors/domain-error';
import { requireCurrentUserId } from '@/infra/auth/session';
import { DrizzleBudgetRepository } from '@/infra/repositories/drizzle-budget.repository';
import { DrizzleCategoryRepository } from '@/infra/repositories/drizzle-category.repository';
import { CreateBudgetUseCase } from '@/modules/budgets/application/create-budget.use-case';
import { DeleteBudgetUseCase } from '@/modules/budgets/application/delete-budget.use-case';
import { UpdateBudgetUseCase } from '@/modules/budgets/application/update-budget.use-case';
import { createBudgetSchema } from '@/modules/budgets/schemas/create-budget.schema';
import { updateBudgetSchema } from '@/modules/budgets/schemas/update-budget.schema';

export interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Every server action here follows the same three responsibilities from
 * conventions.md: validate input (Zod), run a use-case, return a result.
 * Business rules live entirely in `modules/budgets/application`.
 */
export async function createBudgetAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = createBudgetSchema.safeParse({
    categoryId: formData.get('categoryId'),
    amount: formData.get('amount'),
    currency: formData.get('currency'),
    periodStart: formData.get('periodStart'),
    periodEnd: formData.get('periodEnd'),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
    };
  }

  try {
    const userId = await requireCurrentUserId();
    const useCase = new CreateBudgetUseCase(
      new DrizzleBudgetRepository(),
      new DrizzleCategoryRepository(),
    );

    await useCase.execute({ id: randomUUID(), userId, ...parsed.data });

    revalidatePath(ROUTES.budgets);
    revalidatePath(ROUTES.dashboard);
    return { success: true };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function updateBudgetAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = updateBudgetSchema.safeParse({
    id: formData.get('id'),
    amount: formData.get('amount'),
    currency: formData.get('currency'),
    periodStart: formData.get('periodStart'),
    periodEnd: formData.get('periodEnd'),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
    };
  }

  try {
    const userId = await requireCurrentUserId();
    const useCase = new UpdateBudgetUseCase(new DrizzleBudgetRepository());
    await useCase.execute({ ...parsed.data, userId });

    revalidatePath(ROUTES.budgets);
    revalidatePath(ROUTES.dashboard);
    return { success: true };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function deleteBudgetAction(id: string): Promise<ActionResult> {
  try {
    const userId = await requireCurrentUserId();
    const useCase = new DeleteBudgetUseCase(new DrizzleBudgetRepository());
    await useCase.execute({ id, userId });

    revalidatePath(ROUTES.budgets);
    revalidatePath(ROUTES.dashboard);
    return { success: true };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

/**
 * Maps domain/validation errors to plain-language messages per ui-ux.md
 * ("Nunca utilizar mensagens técnicas") — anything unexpected falls back to
 * a generic, still-honest message instead of leaking internals.
 */
function toUserMessage(error: unknown): string {
  if (error instanceof DomainError) {
    return error.message;
  }
  return 'Não foi possível concluir esta ação. Tente novamente.';
}
