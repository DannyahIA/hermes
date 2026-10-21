'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { TransactionGrouping } from '@/core/contracts/transaction-repository';
import { scrollRootOf } from '@/shared/lib/scroll-root';
import {
  type TransactionQuery,
  transactionSearch,
} from '@/shared/lib/transaction-query';

import type { ListedPage, ListedTransaction } from './listed-transaction';

const PAGE_SIZE = 50;
/** The endpoint's cap: a refresh reloads at most this many rows. */
const MAX_RELOAD = 500;

interface Loaded {
  transactions: ListedTransaction[];
  totals: Record<string, number>;
  suggestions: Record<string, string[]>;
  next: string | null;
}

async function fetchPage(
  query: TransactionQuery,
  grouping: TransactionGrouping,
  cursor: string,
  limit: number,
): Promise<ListedPage> {
  const params = new URLSearchParams(transactionSearch(query));
  params.set('grouping', grouping);
  params.set('cursor', cursor);
  params.set('limit', String(limit));
  const response = await fetch(`/api/transactions?${params.toString()}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as ListedPage;
}

/**
 * The rows of `/transactions` past the first page. The first page comes
 * from the server render (`initial`); each time `sentinelRef`'s element
 * nears the viewport, the next page is fetched and appended.
 *
 * After a mutation the server renders a fresh first page. The rows loaded
 * past it are then fetched again in one request, the old ones staying on
 * screen meanwhile, so an edit at the bottom of a long scroll neither
 * shrinks the list nor shows stale rows for good. The caller remounts this
 * (a `key`) when the filters or the grouping change.
 */
export function useTransactionPages(
  initial: ListedPage,
  query: TransactionQuery,
  grouping: TransactionGrouping,
) {
  const [loaded, setLoaded] = useState<Loaded>({
    transactions: [],
    totals: {},
    suggestions: {},
    next: initial.nextCursor,
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [reload, setReload] = useState<{
    cursor: string;
    count: number;
  } | null>(null);
  /**
   * The cursor last asked for. An observer from an earlier render can still
   * fire with that render's cursor after its page arrived; asking for it
   * again would list the page twice.
   */
  const requested = useRef<string | null>(null);
  /** Bumped by a reload, so a page fetched before it is thrown away. */
  const generation = useRef(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const [source, setSource] = useState(initial);
  if (source !== initial) {
    setSource(initial);
    if (loaded.transactions.length > 0 && initial.nextCursor) {
      setReload({
        cursor: initial.nextCursor,
        count: loaded.transactions.length,
      });
    } else {
      // Nothing was loaded past the first page, or it now holds everything.
      setLoaded({
        transactions: [],
        totals: {},
        suggestions: {},
        next: initial.nextCursor,
      });
    }
  }

  useEffect(() => {
    if (!reload) return;
    generation.current += 1;
    requested.current = null;
    const current = generation.current;
    fetchPage(
      query,
      grouping,
      reload.cursor,
      Math.min(Math.max(reload.count, PAGE_SIZE), MAX_RELOAD),
    )
      .then((page) => {
        if (generation.current !== current) return;
        setLoaded({
          transactions: page.transactions,
          totals: page.totals,
          suggestions: page.suggestions,
          next: page.nextCursor,
        });
      })
      .catch(() => {
        // The old rows stay; scrolling on will try again from where they end.
      })
      .finally(() => {
        if (generation.current === current) setReload(null);
      });
  }, [reload, query, grouping]);

  const loadMore = useCallback(async () => {
    const cursor = loaded.next;
    if (reload || !cursor || requested.current === cursor) return;
    requested.current = cursor;
    const current = generation.current;
    setStatus('loading');
    try {
      const page = await fetchPage(query, grouping, cursor, PAGE_SIZE);
      // A reload began meanwhile and brings these rows itself.
      if (generation.current !== current) {
        setStatus('idle');
        return;
      }
      setLoaded((previous) => {
        const known = new Set(previous.transactions.map((row) => row.id));
        return {
          transactions: [
            ...previous.transactions,
            ...page.transactions.filter((row) => !known.has(row.id)),
          ],
          totals: { ...previous.totals, ...page.totals },
          suggestions: { ...previous.suggestions, ...page.suggestions },
          next: page.nextCursor,
        };
      });
      setStatus('idle');
    } catch {
      // "Tentar de novo" asks for the same page again.
      if (requested.current === cursor) requested.current = null;
      setStatus('error');
    }
  }, [loaded.next, reload, query, grouping]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || status === 'error') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      // Start before the end is on screen.
      // Without `root` the margin counts from the window, but the frame clips first.
      { root: scrollRootOf(node), rootMargin: '600px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore, status]);

  // The first page wins: it is the newest render. A row that moved into it
  // (something above it was deleted) is not listed twice.
  const seen = new Set(initial.transactions.map((row) => row.id));
  const transactions = [
    ...initial.transactions,
    ...loaded.transactions.filter((row) => !seen.has(row.id)),
  ];

  return {
    transactions,
    totals: { ...loaded.totals, ...initial.totals },
    suggestions: { ...loaded.suggestions, ...initial.suggestions },
    hasMore: loaded.next !== null,
    status,
    loadMore,
    sentinelRef,
  };
}
