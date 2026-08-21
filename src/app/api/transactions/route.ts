import type { NextRequest } from 'next/server';

import type { TransactionType } from '@/config/constants';
import { requireCurrentUserId } from '@/infra/auth/session';
import { DrizzleAccountRepository } from '@/infra/repositories/drizzle-account.repository';
import { DrizzleCategoryRepository } from '@/infra/repositories/drizzle-category.repository';
import { DrizzleTransactionRepository } from '@/infra/repositories/drizzle-transaction.repository';
import { GetTransactionsUseCase } from '@/modules/transactions/application/get-transactions.use-case';
import {
  decodeTransactionCursor,
  encodeTransactionCursor,
} from '@/shared/lib/transaction-cursor';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function isTransactionType(value: string | null): value is TransactionType {
  return value === 'income' || value === 'expense' || value === 'transfer';
}

/**
 * Incremental-load endpoint for `/transactions` (see `useInfiniteTransactions`).
 * The first ~`limit` rows still come from the page's own server-side fetch on
 * initial load; every subsequent page the user scrolls into comes from here,
 * so the DB is never asked to return more than one page at a time.
 */
export async function GET(request: NextRequest) {
  let userId: string;
  try {
    userId = await requireCurrentUserId();
  } catch {
    return Response.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const accountId = params.get('accountId') || undefined;
  const categoryId = params.get('categoryId') || undefined;
  const typeParam = params.get('type');
  const type = isTransactionType(typeParam) ? typeParam : undefined;
  const fromParam = params.get('from');
  const toParam = params.get('to');
  const from = fromParam ? new Date(`${fromParam}T00:00:00`) : undefined;
  const to = toParam ? new Date(`${toParam}T23:59:59.999`) : undefined;

  const limitParam = Number(params.get('limit'));
  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(limitParam, MAX_LIMIT)
      : DEFAULT_LIMIT;

  const cursorParam = params.get('cursor');
  const cursor = cursorParam
    ? (decodeTransactionCursor(cursorParam) ?? undefined)
    : undefined;
  if (cursorParam && !cursor) {
    return Response.json({ error: 'Cursor inválido.' }, { status: 400 });
  }

  const [accounts, categories, transactions] = await Promise.all([
    new DrizzleAccountRepository().findByUserId(userId),
    new DrizzleCategoryRepository().findByUserId(userId),
    new GetTransactionsUseCase(new DrizzleTransactionRepository()).execute(
      userId,
      {
        accountId,
        categoryId,
        type,
        from,
        to,
        cursor,
        pageSize: limit + 1,
      },
    ),
  ]);

  const hasMore = transactions.length > limit;
  const page = transactions.slice(0, limit);
  const last = page.at(-1);
  const nextCursor =
    hasMore && last
      ? encodeTransactionCursor({ occurredAt: last.occurredAt, id: last.id })
      : null;

  const accountNameById = new Map(
    accounts.map((account) => [account.id, account.name]),
  );
  const categoryNameById = new Map(
    categories.map((category) => [category.id, category.name]),
  );

  return Response.json({
    transactions: page.map((transaction) => ({
      id: transaction.id,
      description: transaction.description,
      amount: transaction.amount,
      type: transaction.type,
      occurredAt: transaction.occurredAt.toISOString(),
      accountId: transaction.accountId,
      accountName: accountNameById.get(transaction.accountId) ?? '—',
      categoryId: transaction.categoryId ?? null,
      categoryName: transaction.categoryId
        ? (categoryNameById.get(transaction.categoryId) ?? null)
        : null,
      installmentPlanId: transaction.installmentPlanId ?? null,
      installmentNumber: transaction.installmentNumber ?? null,
      recurringRuleId: transaction.recurringRuleId ?? null,
    })),
    nextCursor,
  });
}
