'use server';

import { randomUUID } from 'node:crypto';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/routes';
import { DomainError } from '@/core/errors/domain-error';
import { requireCurrentUserId } from '@/infra/auth/session';
import { DrizzleCategoryRepository } from '@/infra/repositories/drizzle-category.repository';
import { DrizzleTransactionRepository } from '@/infra/repositories/drizzle-transaction.repository';
import { ArchiveCategoryUseCase } from '@/modules/categories/application/archive-category.use-case';
import { CreateCategoryUseCase } from '@/modules/categories/application/create-category.use-case';
import { DeleteCategoryUseCase } from '@/modules/categories/application/delete-category.use-case';
import { UpdateCategoryUseCase } from '@/modules/categories/application/update-category.use-case';
import { createCategorySchema } from '@/modules/categories/schemas/create-category.schema';
import { updateCategorySchema } from '@/modules/categories/schemas/update-category.schema';

export interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Every server action here follows the same three responsibilities from
 * conventions.md: validate input (Zod), run a use-case, return a result.
 * Business rules live entirely in `modules/categories/application`.
 */
export async function createCategoryAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = createCategorySchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
    color: formData.get('color'),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
    };
  }

  try {
    const userId = await requireCurrentUserId();
    const useCase = new CreateCategoryUseCase(new DrizzleCategoryRepository());

    await useCase.execute({ id: randomUUID(), userId, ...parsed.data });

    revalidatePath(ROUTES.categories);
    revalidatePath(ROUTES.transactions);
    revalidatePath(ROUTES.budgets);
    return { success: true };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function updateCategoryAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = updateCategorySchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    description: formData.get('description'),
    color: formData.get('color'),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
    };
  }

  try {
    const userId = await requireCurrentUserId();
    const useCase = new UpdateCategoryUseCase(new DrizzleCategoryRepository());
    await useCase.execute({ ...parsed.data, userId });

    revalidatePath(ROUTES.categories);
    revalidatePath(ROUTES.transactions);
    revalidatePath(ROUTES.budgets);
    return { success: true };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function archiveCategoryAction(
  id: string,
  archived: boolean,
): Promise<ActionResult> {
  try {
    const userId = await requireCurrentUserId();
    const useCase = new ArchiveCategoryUseCase(new DrizzleCategoryRepository());
    await useCase.execute({ id, userId, archived });

    revalidatePath(ROUTES.categories);
    revalidatePath(ROUTES.transactions);
    revalidatePath(ROUTES.budgets);
    return { success: true };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  try {
    const userId = await requireCurrentUserId();
    const transactionRepository = new DrizzleTransactionRepository();
    const useCase = new DeleteCategoryUseCase(
      new DrizzleCategoryRepository(),
      async (categoryId) => {
        const transactions = await transactionRepository.findByUserId(userId, {
          categoryId,
        });
        return transactions.length > 0;
      },
    );
    await useCase.execute({ id, userId });

    revalidatePath(ROUTES.categories);
    revalidatePath(ROUTES.transactions);
    revalidatePath(ROUTES.budgets);
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
