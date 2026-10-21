import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ListedPage, ListedTransaction } from './listed-transaction';
import { useTransactionPages } from './use-transaction-pages';

function row(id: string): ListedTransaction {
  return {
    id,
    description: id,
    amount: 10,
    type: 'expense',
    accountId: 'checking-1',
    categoryId: null,
    settlesAccountId: null,
    installmentPlanId: null,
    recurringRuleId: null,
    source: 'manual',
    day: '2026-10-19',
    time: null,
  };
}

function page(
  ids: string[],
  nextCursor: string | null,
  totals: Record<string, number> = {},
): ListedPage {
  return {
    transactions: ids.map(row),
    nextCursor,
    totals,
    suggestions: {},
    newCategories: {},
  };
}

/** Answers `GET /api/transactions` by cursor; records each request. */
function serve(pages: Record<string, ListedPage>) {
  const requests: URLSearchParams[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const params = new URL(url, 'http://localhost').searchParams;
      requests.push(params);
      const body = pages[params.get('cursor') ?? ''];
      return new Response(JSON.stringify(body), {
        status: body ? 200 : 404,
      });
    }),
  );
  return requests;
}

const ids = (rows: ListedTransaction[]) => rows.map((r) => r.id);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useTransactionPages', () => {
  it('appends the next page with its totals, and asks for each page once', async () => {
    const requests = serve({
      c1: page(['c', 'd'], null, { '2026-10-18': -20 }),
    });
    // As the server renders it: the same object until it renders again.
    const initial = page(['a', 'b'], 'c1', { '2026-10-19': -20 });
    const query = { q: 'pão' };
    const { result } = renderHook(() =>
      useTransactionPages(initial, query, 'day'),
    );

    // The observer of the first render keeps this one.
    const loadFromFirstRender = result.current.loadMore;
    await act(async () => {
      await loadFromFirstRender();
    });
    // It fires again before the next render replaces it.
    await act(async () => {
      await loadFromFirstRender();
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].get('cursor')).toBe('c1');
    expect(requests[0].get('q')).toBe('pão');
    expect(requests[0].get('grouping')).toBe('day');
    expect(ids(result.current.transactions)).toEqual(['a', 'b', 'c', 'd']);
    expect(result.current.totals).toEqual({
      '2026-10-19': -20,
      '2026-10-18': -20,
    });
    expect(result.current.hasMore).toBe(false);
  });

  it('reloads what was loaded past a fresh first page, keeping it on screen meanwhile', async () => {
    const requests = serve({
      c1: page(['c', 'd'], 'c2'),
      // After "b" was deleted, the server's first page ends elsewhere.
      c1b: page(['d', 'e'], null),
    });
    const query = {};
    const { result, rerender } = renderHook(
      ({ initial }) => useTransactionPages(initial, query, 'day'),
      { initialProps: { initial: page(['a', 'b'], 'c1') } },
    );
    await act(async () => {
      await result.current.loadMore();
    });
    expect(ids(result.current.transactions)).toEqual(['a', 'b', 'c', 'd']);

    rerender({ initial: page(['a', 'c'], 'c1b') });
    // Until the reload lands, the rows it replaces stay, without repeats.
    expect(ids(result.current.transactions)).toEqual(['a', 'c', 'd']);

    await waitFor(() =>
      expect(ids(result.current.transactions)).toEqual(['a', 'c', 'd', 'e']),
    );
    expect(requests.at(-1)?.get('cursor')).toBe('c1b');
    // At least a page, enough for everything that had been loaded.
    expect(requests.at(-1)?.get('limit')).toBe('50');
    expect(result.current.hasMore).toBe(false);
  });

  it('drops the loaded rows when the first page now holds everything', async () => {
    serve({ c1: page(['c'], null) });
    const query = {};
    const { result, rerender } = renderHook(
      ({ initial }) => useTransactionPages(initial, query, 'day'),
      { initialProps: { initial: page(['a', 'b'], 'c1') } },
    );
    await act(async () => {
      await result.current.loadMore();
    });

    rerender({ initial: page(['a', 'c'], null) });

    expect(ids(result.current.transactions)).toEqual(['a', 'c']);
    expect(result.current.hasMore).toBe(false);
  });

  it('lets "Tentar de novo" ask for a page that failed', async () => {
    const requests = serve({});
    const initial = page(['a'], 'c1');
    const query = {};
    const { result } = renderHook(() =>
      useTransactionPages(initial, query, 'day'),
    );

    await act(async () => {
      await result.current.loadMore();
    });
    expect(result.current.status).toBe('error');

    await act(async () => {
      await result.current.loadMore();
    });
    expect(requests).toHaveLength(2);
  });
});
