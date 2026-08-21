'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface ClientTransaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  occurredAt: string;
  accountId: string;
  accountName: string;
  categoryId: string | null;
  categoryName: string | null;
  installmentPlanId: string | null;
  installmentNumber: number | null;
  recurringRuleId: string | null;
}

interface TransactionsResponse {
  transactions: ClientTransaction[];
  nextCursor: string | null;
}

export interface InfiniteTransactionFilters {
  accountId?: string;
  categoryId?: string;
  type?: string;
  from?: string;
  to?: string;
}

/**
 * Drives incremental loading of `/transactions`: starts from the server-
 * rendered first page (`initial`), and fetches one more page from
 * `GET /api/transactions` each time `sentinelRef`'s element enters the
 * viewport, appending (never replacing) results. A ref-backed `isFetching`
 * guard prevents the IntersectionObserver from firing overlapping requests
 * during a fast scroll.
 */
export function useInfiniteTransactions(
  initial: TransactionsResponse,
  filters: InfiniteTransactionFilters,
) {
  const [transactions, setTransactions] = useState(initial.transactions);
  const [nextCursor, setNextCursor] = useState(initial.nextCursor);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isFetchingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Filters changing means a fresh query (new page navigation already
  // remounts the server component with a new `initial`, but this also
  // covers client-side filter changes without a full navigation, should a
  // future task add those). Resynced by adjusting state during render
  // (per https://react.dev/learn/you-might-not-need-an-effect) rather than
  // in a useEffect, to avoid a redundant extra render on every change.
  const [prevInitial, setPrevInitial] = useState(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setTransactions(initial.transactions);
    setNextCursor(initial.nextCursor);
  }

  const loadMore = useCallback(async () => {
    if (isFetchingRef.current || !nextCursor) return;
    isFetchingRef.current = true;
    setIsFetchingMore(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('limit', '50');
      params.set('cursor', nextCursor);
      if (filters.accountId) params.set('accountId', filters.accountId);
      if (filters.categoryId) params.set('categoryId', filters.categoryId);
      if (filters.type) params.set('type', filters.type);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);

      const response = await fetch(`/api/transactions?${params.toString()}`);
      if (!response.ok) {
        setError('Não foi possível carregar mais transações.');
        return;
      }

      const data = (await response.json()) as TransactionsResponse;
      setTransactions((current) => [...current, ...data.transactions]);
      setNextCursor(data.nextCursor);
    } catch {
      setError('Não foi possível carregar mais transações.');
    } finally {
      isFetchingRef.current = false;
      setIsFetchingMore(false);
    }
  }, [
    nextCursor,
    filters.accountId,
    filters.categoryId,
    filters.type,
    filters.from,
    filters.to,
  ]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: '400px' }, // start fetching before the sentinel is actually on screen
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore]);

  return {
    transactions,
    isFetchingMore,
    hasMore: nextCursor !== null,
    error,
    loadMore,
    sentinelRef,
  };
}
