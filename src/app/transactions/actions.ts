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
import { GetTransactionsUseCase } from '@/modules/transactions/application/get-transactions.use-case';
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
  const amountMode =
    formData.get('amountMode') === 'installment' ? 'installment' : 'total';
  const amountValue = formData.get('amount');

  const parsed = createInstallmentPlanSchema.safeParse({
    accountId: formData.get('accountId'),
    categoryId: formData.get('categoryId'),
    description: formData.get('description'),
    totalAmount: amountMode === 'total' ? amountValue : undefined,
    installmentAmount: amountMode === 'installment' ? amountValue : undefined,
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

interface ParsedImportRow {
  lineNumber: number;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  occurredAt: Date;
  accountId: string;
  accountName: string;
  categoryId?: string;
  categoryName?: string;
}

type ImportRowParseResult =
  | { ok: true; row: ParsedImportRow }
  | { ok: false; lineNumber: number; reason: string };

/**
 * Validates and parses a single CSV data row, shared by `previewImportAction`
 * and `confirmImportAction`'s upstream preview step so parsing logic lives
 * in one place.
 */
function parseImportRow(
  row: string[],
  lineNumber: number,
  columnIndexByKey: Map<ImportColumnKey, number>,
  accountByName: Map<string, { id: string; name: string }>,
  categoryByName: Map<string, { id: string; name: string }>,
): ImportRowParseResult {
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

  if (type === 'transfer')
    return {
      ok: false,
      lineNumber,
      reason: 'transferências não são importadas',
    };
  if (type !== 'income' && type !== 'expense')
    return { ok: false, lineNumber, reason: 'tipo inválido' };
  if (!description) return { ok: false, lineNumber, reason: 'descrição vazia' };

  const account = accountByName.get(normalizeText(accountName));
  if (!account)
    return {
      ok: false,
      lineNumber,
      reason: `conta "${accountName}" não encontrada`,
    };

  const category = categoryName
    ? categoryByName.get(normalizeText(categoryName))
    : undefined;
  if (categoryName && !category) {
    return {
      ok: false,
      lineNumber,
      reason: `categoria "${categoryName}" não encontrada`,
    };
  }

  if (!Number.isFinite(amount) || amount <= 0)
    return { ok: false, lineNumber, reason: 'valor inválido' };
  if (Number.isNaN(occurredAt.getTime()))
    return { ok: false, lineNumber, reason: 'data inválida' };

  return {
    ok: true,
    row: {
      lineNumber,
      description,
      amount,
      type,
      occurredAt,
      accountId: account.id,
      accountName: account.name,
      categoryId: category?.id,
      categoryName: category?.name,
    },
  };
}

export interface ImportPreviewRow {
  lineNumber: number;
  description: string;
  accountId: string;
  accountName: string;
  categoryId?: string;
  categoryName?: string;
  type: 'income' | 'expense';
  amount: number;
  occurredAt: string; // ISO date, for JSON round-trip to the client and back
  status: 'valid' | 'valid_possible_duplicate' | 'invalid';
  reason?: string;
}

export interface ImportPreviewState {
  success: boolean;
  error?: string;
  rows?: ImportPreviewRow[];
}

/**
 * Parses and validates the uploaded CSV (same logic `parseImportRow`
 * uses) but persists nothing — returns every row's status for the client
 * to render as a preview. Duplicate detection: a `valid` row whose account,
 * exact amount, and date (±1 day) already match an existing transaction is
 * marked `valid_possible_duplicate` rather than `invalid` — the user
 * decides whether to import it anyway in the preview UI.
 */
export async function previewImportAction(
  _prev: ImportPreviewState,
  formData: FormData,
): Promise<ImportPreviewState> {
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

    const [accounts, categories, existingTransactions] = await Promise.all([
      new DrizzleAccountRepository().findByUserId(userId),
      new DrizzleCategoryRepository().findByUserId(userId),
      new GetTransactionsUseCase(new DrizzleTransactionRepository()).execute(
        userId,
        { pageSize: 10_000 },
      ),
    ]);
    const accountByName = new Map(
      accounts.map((account) => [normalizeText(account.name), account]),
    );
    const categoryByName = new Map(
      categories.map((category) => [normalizeText(category.name), category]),
    );

    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    const previewRows: ImportPreviewRow[] = dataRows.map((row, rowIndex) => {
      const lineNumber = rowIndex + 2;
      const result = parseImportRow(
        row,
        lineNumber,
        columnIndexByKey,
        accountByName,
        categoryByName,
      );

      if (!result.ok) {
        return {
          lineNumber: result.lineNumber,
          description: '',
          accountId: '',
          accountName: '',
          type: 'expense',
          amount: 0,
          occurredAt: '',
          status: 'invalid',
          reason: result.reason,
        };
      }

      const isDuplicate = existingTransactions.some(
        (t) =>
          t.accountId === result.row.accountId &&
          t.amount === result.row.amount &&
          Math.abs(t.occurredAt.getTime() - result.row.occurredAt.getTime()) <=
            ONE_DAY_MS,
      );

      return {
        lineNumber: result.row.lineNumber,
        description: result.row.description,
        accountId: result.row.accountId,
        accountName: result.row.accountName,
        categoryId: result.row.categoryId,
        categoryName: result.row.categoryName,
        type: result.row.type,
        amount: result.row.amount,
        occurredAt: result.row.occurredAt.toISOString(),
        status: isDuplicate ? 'valid_possible_duplicate' : 'valid',
      };
    });

    return { success: true, rows: previewRows };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

/**
 * Persists exactly the rows the user kept checked in the preview
 * (`ImportPreviewTable`) — already fully validated by `previewImportAction`,
 * so this does not re-parse the CSV, only re-runs `CreateTransactionUseCase`
 * per row (one `withTransaction` each, so one bad row can't roll back the
 * others).
 */
export async function confirmImportAction(
  rows: ImportPreviewRow[],
): Promise<ActionResult> {
  try {
    const userId = await requireCurrentUserId();
    let imported = 0;
    const reasons: string[] = [];

    for (const row of rows) {
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
            accountId: row.accountId,
            categoryId: row.categoryId,
            description: row.description,
            amount: row.amount,
            type: row.type,
            occurredAt: new Date(row.occurredAt),
          });
        });
        imported += 1;
      } catch (error) {
        reasons.push(`linha ${row.lineNumber}: ${toUserMessage(error)}`);
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
