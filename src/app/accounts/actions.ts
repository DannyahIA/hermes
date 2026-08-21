'use server';

import { randomUUID } from 'node:crypto';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/routes';
import { DomainError } from '@/core/errors/domain-error';
import { requireCurrentUserId } from '@/infra/auth/session';
import { withTransaction } from '@/infra/database/transaction';
import { DrizzleAccountRepository } from '@/infra/repositories/drizzle-account.repository';
import { DrizzleTransactionRepository } from '@/infra/repositories/drizzle-transaction.repository';
import { ArchiveAccountUseCase } from '@/modules/accounts/application/archive-account.use-case';
import { CreateAccountUseCase } from '@/modules/accounts/application/create-account.use-case';
import { DeleteAccountUseCase } from '@/modules/accounts/application/delete-account.use-case';
import { PayCreditCardBillUseCase } from '@/modules/accounts/application/pay-credit-card-bill.use-case';
import { UpdateAccountUseCase } from '@/modules/accounts/application/update-account.use-case';
import { createAccountSchema } from '@/modules/accounts/schemas/create-account.schema';
import { payCreditCardBillSchema } from '@/modules/accounts/schemas/pay-credit-card-bill.schema';
import { updateAccountSchema } from '@/modules/accounts/schemas/update-account.schema';

export interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Every server action here follows the same three responsibilities from
 * conventions.md: validate input (Zod), run a use-case, return a result.
 * Business rules live entirely in `modules/accounts/application`.
 */
export async function createAccountAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = createAccountSchema.safeParse({
    name: formData.get('name'),
    type: formData.get('type'),
    balance: formData.get('balance'),
    currency: formData.get('currency'),
    closingDay: formData.get('closingDay') || undefined,
    dueDay: formData.get('dueDay') || undefined,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
    };
  }

  try {
    const userId = await requireCurrentUserId();
    const useCase = new CreateAccountUseCase(new DrizzleAccountRepository());

    await useCase.execute({ id: randomUUID(), userId, ...parsed.data });

    revalidatePath(ROUTES.accounts);
    revalidatePath(ROUTES.dashboard);
    return { success: true };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function updateAccountAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = updateAccountSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    type: formData.get('type'),
    currency: formData.get('currency'),
    closingDay: formData.get('closingDay') || undefined,
    dueDay: formData.get('dueDay') || undefined,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
    };
  }

  try {
    await requireCurrentUserId();
    const useCase = new UpdateAccountUseCase(new DrizzleAccountRepository());
    await useCase.execute(parsed.data);

    revalidatePath(ROUTES.accounts);
    return { success: true };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function archiveAccountAction(
  id: string,
  archived: boolean,
): Promise<ActionResult> {
  try {
    await requireCurrentUserId();
    const useCase = new ArchiveAccountUseCase(new DrizzleAccountRepository());
    await useCase.execute({ id, archived });

    revalidatePath(ROUTES.accounts);
    revalidatePath(ROUTES.dashboard);
    return { success: true };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function deleteAccountAction(id: string): Promise<ActionResult> {
  try {
    await requireCurrentUserId();
    const transactionRepository = new DrizzleTransactionRepository();
    const useCase = new DeleteAccountUseCase(
      new DrizzleAccountRepository(),
      async (accountId) => {
        const transactions =
          await transactionRepository.findByAccountId(accountId);
        return transactions.length > 0;
      },
    );
    await useCase.execute({ id });

    revalidatePath(ROUTES.accounts);
    revalidatePath(ROUTES.dashboard);
    return { success: true };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function payCreditCardBillAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = payCreditCardBillSchema.safeParse({
    creditAccountId: formData.get('creditAccountId'),
    payingAccountId: formData.get('payingAccountId'),
    amount: formData.get('amount'),
    description: formData.get('description') || undefined,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
    };
  }

  try {
    const userId = await requireCurrentUserId();

    // A single DB transaction backs both account balance updates and the
    // new transaction row — see infra/database/transaction.ts.
    await withTransaction(async (tx) => {
      const useCase = new PayCreditCardBillUseCase(
        new DrizzleTransactionRepository(tx),
        new DrizzleAccountRepository(tx),
      );
      await useCase.execute({ userId, ...parsed.data });
    });

    revalidatePath(ROUTES.accounts);
    revalidatePath(ROUTES.transactions);
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
