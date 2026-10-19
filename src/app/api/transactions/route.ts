import type { NextRequest } from 'next/server';

import {
  isGrouping,
  type ListedPage,
} from '@/app/transactions/listed-transaction';
import {
  loadTransactionPage,
  TRANSACTIONS_PAGE_SIZE,
} from '@/app/transactions/load-transaction-page';
import { requireCurrentUserId } from '@/infra/auth/session';
import { decodeTransactionCursor } from '@/shared/lib/transaction-cursor';
import { readTransactionQuery } from '@/shared/lib/transaction-query';

/** Enough to reload, in one request, everything a long scroll had loaded. */
const MAX_LIMIT = 500;

/**
 * Incremental-load endpoint for `/transactions` (see `useTransactionPages`).
 * The first page comes from the page's own server render; every page the
 * user scrolls into comes from here, with the same filters read the same
 * way (`readTransactionQuery`), and the totals of the groups it holds.
 */
export async function GET(request: NextRequest) {
  let userId: string;
  try {
    userId = await requireCurrentUserId();
  } catch {
    return Response.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const limitParam = Number(params.get('limit'));
  const limit =
    Number.isInteger(limitParam) && limitParam > 0
      ? Math.min(limitParam, MAX_LIMIT)
      : TRANSACTIONS_PAGE_SIZE;

  const cursorParam = params.get('cursor');
  const cursor = cursorParam
    ? (decodeTransactionCursor(cursorParam) ?? undefined)
    : undefined;
  if (cursorParam && !cursor) {
    return Response.json({ error: 'Cursor inválido.' }, { status: 400 });
  }

  const grouping = params.get('grouping');
  const page: ListedPage = await loadTransactionPage(userId, {
    query: readTransactionQuery(params),
    grouping: isGrouping(grouping) ? grouping : 'day',
    cursor,
    limit,
  });
  return Response.json(page);
}
