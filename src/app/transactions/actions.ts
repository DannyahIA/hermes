'use server';

import { randomUUID } from 'node:crypto';

import { revalidatePath } from 'next/cache';

import {
  TRANSACTION_TYPE_LABELS,
  type TransactionType,
} from '@/config/constants';
import { ROUTES } from '@/config/routes';
import { DomainError } from '@/core/errors/domain-error';
import { requireCurrentUserId } from '@/infra/auth/session';
import { withTransaction } from '@/infra/database/transaction';
import { DrizzleAccountRepository } from '@/infra/repositories/drizzle-account.repository';
import { DrizzleCategoryRepository } from '@/infra/repositories/drizzle-category.repository';
import { DrizzleInstallmentPlanRepository } from '@/infra/repositories/drizzle-installment-plan.repository';
import { DrizzleTransactionRepository } from '@/infra/repositories/drizzle-transaction.repository';
import { CreateInstallmentPlanUseCase } from '@/modules/installments/application/create-installment-plan.use-case';
import { DeleteInstallmentPlanUseCase } from '@/modules/installments/application/delete-installment-plan.use-case';
import { UpdateInstallmentUseCase } from '@/modules/installments/application/update-installment.use-case';
import { createInstallmentPlanSchema } from '@/modules/installments/schemas/create-installment-plan.schema';
import { updateInstallmentSchema } from '@/modules/installments/schemas/update-installment.schema';
import { CreateTransactionUseCase } from '@/modules/transactions/application/create-transaction.use-case';
import { DeleteTransactionUseCase } from '@/modules/transactions/application/delete-transaction.use-case';
import { TransferMoneyUseCase } from '@/modules/transactions/application/transfer-money.use-case';
import { UpdateTransactionUseCase } from '@/modules/transactions/application/update-transaction.use-case';
import { createTransactionSchema } from '@/modules/transactions/schemas/create-transaction.schema';
import { transferMoneySchema } from '@/modules/transactions/schemas/transfer-money.schema';
import { updateTransactionSchema } from '@/modules/transactions/schemas/update-transaction.schema';
import { parseCsv } from '@/shared/lib/csv';

export interface ActionResult {
  success: boolean;
  error?: string;
  /** Human-readable summary for actions that report more than pass/fail — e.g. an import's row count. */
  message?: string;
}

function toUserMessage(error: unknown): string {
  if (error instanceof DomainError) {
    return error.message;
  }
  return 'Não foi possível concluir esta ação. Tente novamente.';
}

function revalidateMoneyPages() {
  revalidatePath(ROUTES.transactions);
  revalidatePath(ROUTES.accounts);
  revalidatePath(ROUTES.dashboard);
  revalidatePath(ROUTES.budgets);
}

export async function createTransactionAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = createTransactionSchema.safeParse({
    accountId: formData.get('accountId'),
    categoryId: formData.get('categoryId'),
    description: formData.get('description'),
    amount: formData.get('amount'),
    type: formData.get('type'),
    occurredAt: formData.get('occurredAt') || undefined,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
    };
  }

  try {
    const userId = await requireCurrentUserId();

    // A single DB transaction backs the account balance update and the new
    // transaction row — see infra/database/transaction.ts.
    await withTransaction(async (tx) => {
      const useCase = new CreateTransactionUseCase(
        new DrizzleTransactionRepository(tx),
        new DrizzleAccountRepository(tx),
        new DrizzleCategoryRepository(tx),
      );
      await useCase.execute({ id: randomUUID(), userId, ...parsed.data });
    });

    revalidateMoneyPages();
    return { success: true };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function createInstallmentAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = createInstallmentPlanSchema.safeParse({
    accountId: formData.get('accountId'),
    categoryId: formData.get('categoryId'),
    description: formData.get('description'),
    totalAmount: formData.get('amount'),
    installmentCount: formData.get('installmentCount'),
    startDate: formData.get('occurredAt') || undefined,
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
      const useCase = new CreateInstallmentPlanUseCase(
        new DrizzleInstallmentPlanRepository(tx),
        new DrizzleTransactionRepository(tx),
        new DrizzleAccountRepository(tx),
        new DrizzleCategoryRepository(tx),
      );
      await useCase.execute({
        id: randomUUID(),
        userId,
        kind: 'purchase',
        ...parsed.data,
        installmentIds: Array.from(
          { length: parsed.data.installmentCount },
          () => randomUUID(),
        ),
      });
    });

    revalidateMoneyPages();
    return { success: true };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function updateInstallmentAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = updateInstallmentSchema.safeParse({
    id: formData.get('id'),
    description: formData.get('description'),
    amount: formData.get('amount') || undefined,
    categoryId: formData.get('categoryId'),
    occurredAt: formData.get('occurredAt') || undefined,
    propagateToFuture: formData.get('propagateToFuture') === 'on',
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
      const useCase = new UpdateInstallmentUseCase(
        new DrizzleTransactionRepository(tx),
        new DrizzleAccountRepository(tx),
        new DrizzleInstallmentPlanRepository(tx),
      );
      await useCase.execute({ userId, ...parsed.data });
    });

    revalidateMoneyPages();
    return { success: true };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function deleteInstallmentPlanAction(
  id: string,
): Promise<ActionResult> {
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

    revalidateMoneyPages();
    return { success: true };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function updateTransactionAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = updateTransactionSchema.safeParse({
    id: formData.get('id'),
    description: formData.get('description'),
    amount: formData.get('amount') || undefined,
    categoryId: formData.get('categoryId'),
    occurredAt: formData.get('occurredAt') || undefined,
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
      const useCase = new UpdateTransactionUseCase(
        new DrizzleTransactionRepository(tx),
        new DrizzleAccountRepository(tx),
      );
      await useCase.execute({ userId, ...parsed.data });
    });

    revalidateMoneyPages();
    return { success: true };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function deleteTransactionAction(
  id: string,
): Promise<ActionResult> {
  try {
    const userId = await requireCurrentUserId();

    await withTransaction(async (tx) => {
      const useCase = new DeleteTransactionUseCase(
        new DrizzleTransactionRepository(tx),
        new DrizzleAccountRepository(tx),
      );
      await useCase.execute({ id, userId });
    });

    revalidateMoneyPages();
    return { success: true };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

type ImportColumnKey =
  'date' | 'description' | 'account' | 'category' | 'type' | 'amount';

const IMPORT_HEADER_KEYS: Record<string, ImportColumnKey> = {
  data: 'date',
  descricao: 'description',
  conta: 'account',
  categoria: 'category',
  tipo: 'type',
  valor: 'amount',
};

const REQUIRED_IMPORT_COLUMNS: ImportColumnKey[] = [
  'date',
  'description',
  'account',
  'type',
  'amount',
];

const TYPE_LABEL_TO_TRANSACTION_TYPE: Record<string, TransactionType> =
  Object.fromEntries(
    Object.entries(TRANSACTION_TYPE_LABELS).map(([type, label]) => [
      normalizeText(label),
      type,
    ]),
  ) as Record<string, TransactionType>;

/**
 * Imports income/expense transactions from a CSV in the same shape the
 * export route produces. Transfers are flagged, not silently dropped —
 * reconstructing a two-leg transfer from one flat CSV row is ambiguous, and
 * deleting/recreating one already works via the transfer form. Each valid
 * row runs its own `withTransaction`, so one bad row never rolls back the
 * good rows already imported.
 */
export async function createImportAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: 'Selecione um arquivo CSV.' };
  }

  const text = await file.text();
  const rows = parseCsv(text).filter((row) =>
    row.some((field) => field.trim() !== ''),
  );

  if (rows.length === 0) {
    return { success: false, error: 'O arquivo está vazio.' };
  }

  const [header, ...dataRows] = rows;
  const columnIndexByKey = new Map<ImportColumnKey, number>();
  header.forEach((cell, index) => {
    const key = IMPORT_HEADER_KEYS[normalizeText(cell)];
    if (key) columnIndexByKey.set(key, index);
  });

  const missingColumn = REQUIRED_IMPORT_COLUMNS.find(
    (key) => !columnIndexByKey.has(key),
  );
  if (missingColumn) {
    return {
      success: false,
      error:
        'Cabeçalho do CSV inválido. Use o mesmo formato do arquivo exportado.',
    };
  }

  try {
    const userId = await requireCurrentUserId();

    const [accounts, categories] = await Promise.all([
      new DrizzleAccountRepository().findByUserId(userId),
      new DrizzleCategoryRepository().findByUserId(userId),
    ]);
    const accountByName = new Map(
      accounts.map((account) => [normalizeText(account.name), account]),
    );
    const categoryByName = new Map(
      categories.map((category) => [normalizeText(category.name), category]),
    );

    let imported = 0;
    const reasons: string[] = [];

    for (const [rowIndex, row] of dataRows.entries()) {
      const lineNumber = rowIndex + 2; // 1 for the header row, 1 for 1-based counting

      const field = (key: ImportColumnKey): string => {
        const columnIndex = columnIndexByKey.get(key);
        return columnIndex === undefined ? '' : (row[columnIndex] ?? '').trim();
      };

      const description = field('description');
      const accountName = field('account');
      const categoryName = field('category');
      const type = TYPE_LABEL_TO_TRANSACTION_TYPE[normalizeText(field('type'))];
      const amount = Number(field('amount').replace(',', '.'));
      const occurredAt = new Date(`${field('date')}T00:00:00`);

      if (type === 'transfer') {
        reasons.push(`linha ${lineNumber}: transferências não são importadas`);
        continue;
      }
      if (type !== 'income' && type !== 'expense') {
        reasons.push(`linha ${lineNumber}: tipo inválido`);
        continue;
      }
      if (!description) {
        reasons.push(`linha ${lineNumber}: descrição vazia`);
        continue;
      }

      const account = accountByName.get(normalizeText(accountName));
      if (!account) {
        reasons.push(
          `linha ${lineNumber}: conta "${accountName}" não encontrada`,
        );
        continue;
      }

      const category = categoryName
        ? categoryByName.get(normalizeText(categoryName))
        : undefined;
      if (categoryName && !category) {
        reasons.push(
          `linha ${lineNumber}: categoria "${categoryName}" não encontrada`,
        );
        continue;
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        reasons.push(`linha ${lineNumber}: valor inválido`);
        continue;
      }
      if (Number.isNaN(occurredAt.getTime())) {
        reasons.push(`linha ${lineNumber}: data inválida`);
        continue;
      }

      try {
        await withTransaction(async (tx) => {
          const useCase = new CreateTransactionUseCase(
            new DrizzleTransactionRepository(tx),
            new DrizzleAccountRepository(tx),
            new DrizzleCategoryRepository(tx),
          );
          await useCase.execute({
            id: randomUUID(),
            userId,
            accountId: account.id,
            categoryId: category?.id,
            description,
            amount,
            type,
            occurredAt,
          });
        });
        imported += 1;
      } catch (error) {
        reasons.push(`linha ${lineNumber}: ${toUserMessage(error)}`);
      }
    }

    if (imported > 0) revalidateMoneyPages();

    const summary = `${imported} importada${imported === 1 ? '' : 's'}, ${reasons.length} ignorada${reasons.length === 1 ? '' : 's'}`;
    const message =
      reasons.length > 0
        ? `${summary} (${reasons.slice(0, 5).join('; ')}${reasons.length > 5 ? '…' : ''})`
        : summary;

    return { success: true, message };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function transferMoneyAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = transferMoneySchema.safeParse({
    fromAccountId: formData.get('fromAccountId'),
    toAccountId: formData.get('toAccountId'),
    amount: formData.get('amount'),
    description: formData.get('description'),
    occurredAt: formData.get('occurredAt') || undefined,
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
      const useCase = new TransferMoneyUseCase(
        new DrizzleTransactionRepository(tx),
        new DrizzleAccountRepository(tx),
      );
      await useCase.execute({ userId, ...parsed.data });
    });

    revalidateMoneyPages();
    return { success: true };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}
