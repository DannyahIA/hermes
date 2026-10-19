import type { NextRequest } from 'next/server';

import { TRANSACTION_TYPE_LABELS } from '@/config/constants';
import { requireCurrentUserId } from '@/infra/auth/session';
import { DrizzleAccountRepository } from '@/infra/repositories/drizzle-account.repository';
import { DrizzleCategoryRepository } from '@/infra/repositories/drizzle-category.repository';
import { DrizzleTransactionRepository } from '@/infra/repositories/drizzle-transaction.repository';
import { GetTransactionsUseCase } from '@/modules/transactions/application/get-transactions.use-case';
import { buildCsv } from '@/shared/lib/csv';
import { toDateInput } from '@/shared/lib/local-day';
import {
  readTransactionQuery,
  toTransactionFilters,
} from '@/shared/lib/transaction-query';

const CSV_HEADER = ['Data', 'Descrição', 'Conta', 'Categoria', 'Tipo', 'Valor'];

// Large enough to cover any real user's history in one export, without
// pulling in a second COUNT-based pagination scheme just for this route.
const EXPORT_MAX_ROWS = 100_000;

/**
 * Streams the user's own transactions (filtered the same way the
 * `/transactions` page's filters work) as a CSV file. Reads the same query
 * params (`readTransactionQuery`), search included, so "Exportar CSV" on
 * that page can simply carry its current query string here.
 */
export async function GET(request: NextRequest) {
  let userId: string;
  try {
    userId = await requireCurrentUserId();
  } catch {
    return new Response('Não autenticado.', { status: 401 });
  }

  const filters = toTransactionFilters(
    readTransactionQuery(request.nextUrl.searchParams),
  );

  const [accounts, categories, transactions] = await Promise.all([
    new DrizzleAccountRepository().findByUserId(userId),
    new DrizzleCategoryRepository().findByUserId(userId),
    new GetTransactionsUseCase(new DrizzleTransactionRepository()).execute(
      userId,
      { ...filters, pageSize: EXPORT_MAX_ROWS },
    ),
  ]);

  const accountNameById = new Map(
    accounts.map((account) => [account.id, account.name]),
  );
  const categoryNameById = new Map(
    categories.map((category) => [category.id, category.name]),
  );

  const rows = transactions.map((transaction) => [
    toDateInput(transaction.occurredAt),
    transaction.description,
    accountNameById.get(transaction.accountId) ?? '',
    transaction.categoryId
      ? (categoryNameById.get(transaction.categoryId) ?? '')
      : '',
    TRANSACTION_TYPE_LABELS[transaction.type],
    transaction.amount.toFixed(2),
  ]);

  // UTF-8 BOM so Excel opens accented characters correctly instead of
  // mojibake.
  const BOM = String.fromCharCode(0xfeff);
  const csv = BOM + buildCsv([CSV_HEADER, ...rows]);

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="transacoes.csv"',
    },
  });
}
