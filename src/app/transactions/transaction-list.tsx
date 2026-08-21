'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { useMemo, useRef } from 'react';

import { TransactionRow } from '@/app/transactions/transaction-row';
import { TransactionRowMobile } from '@/app/transactions/transaction-row-mobile';
import {
  TransactionRowSkeleton,
  TransactionRowSkeletonMobile,
} from '@/app/transactions/transaction-row-skeleton';
import {
  type ClientTransaction,
  type InfiniteTransactionFilters,
  useInfiniteTransactions,
} from '@/app/transactions/use-infinite-transactions';
import { groupTransactionsByPeriod } from '@/shared/lib/group-transactions-by-period';

interface TransactionListProps {
  initial: { transactions: ClientTransaction[]; nextCursor: string | null };
  filters: InfiniteTransactionFilters;
  categories: Array<{ id: string; name: string }>;
  installmentCountByPlanId: Map<string, number>;
}

/** `ClientTransaction` with `occurredAt` parsed to a real `Date` — both
 * `groupTransactionsByPeriod` (needs `{ occurredAt: Date }`) and the row
 * components (which take `occurredAt: Date`, not a string) can consume this
 * directly, with the ISO string parsed exactly once per transaction. */
type EnrichedTransaction = Omit<ClientTransaction, 'occurredAt'> & {
  occurredAt: Date;
};

type VirtualItem =
  | { kind: 'header'; label: string }
  | { kind: 'row'; transaction: EnrichedTransaction };

export function TransactionList({
  initial,
  filters,
  categories,
  installmentCountByPlanId,
}: TransactionListProps) {
  const { transactions, isFetchingMore, hasMore, sentinelRef } =
    useInfiniteTransactions(initial, filters);

  const enriched = useMemo<EnrichedTransaction[]>(
    () =>
      transactions.map((t) => ({ ...t, occurredAt: new Date(t.occurredAt) })),
    [transactions],
  );

  const groups = useMemo(
    () => groupTransactionsByPeriod(enriched, new Date()),
    [enriched],
  );

  // Each group's `items` are already the exact EnrichedTransaction objects
  // from `enriched` (groupTransactionsByPeriod only buckets, never clones),
  // so flattening is a single pass with no `.find()` — the O(n²) re-scan
  // this component exists to avoid.
  const flatItems = useMemo<VirtualItem[]>(() => {
    const items: VirtualItem[] = [];
    for (const group of groups) {
      items.push({ kind: 'header', label: group.label });
      for (const transaction of group.items) {
        items.push({ kind: 'row', transaction });
      }
    }
    return items;
  }, [groups]);

  const parentRef = useRef<HTMLDivElement>(null);

  // TanStack Virtual's useVirtualizer() returns functions (measureElement,
  // etc.) that the React Compiler can't safely memoize; this is expected
  // for this API, so the compiler's warning is suppressed below.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => (flatItems[index]?.kind === 'header' ? 40 : 64),
    overscan: 8,
  });

  if (transactions.length === 0) {
    return null; // empty state is rendered by the parent page (Round 3 scope) — this component only handles a non-empty list
  }

  return (
    <div
      ref={parentRef}
      className="max-h-[75vh] overflow-y-auto"
      role="list"
      aria-label="Transações"
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          position: 'relative',
          width: '100%',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = flatItems[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {item.kind === 'header' ? (
                <div className="bg-background/95 text-muted-foreground sticky top-0 z-10 px-4 py-2 text-xs font-semibold tracking-wide uppercase backdrop-blur">
                  {item.label}
                </div>
              ) : (
                <>
                  <table className="hidden w-full sm:table">
                    <tbody>
                      <TransactionRow
                        id={item.transaction.id}
                        description={item.transaction.description}
                        amount={item.transaction.amount}
                        type={item.transaction.type}
                        occurredAt={item.transaction.occurredAt}
                        accountName={item.transaction.accountName}
                        categoryId={item.transaction.categoryId ?? undefined}
                        categoryName={
                          item.transaction.categoryName ?? undefined
                        }
                        categories={categories}
                        installmentLabel={
                          item.transaction.installmentPlanId &&
                          item.transaction.installmentNumber
                            ? `${item.transaction.installmentNumber}/${installmentCountByPlanId.get(item.transaction.installmentPlanId) ?? '?'}`
                            : undefined
                        }
                        isRecurring={Boolean(item.transaction.recurringRuleId)}
                      />
                    </tbody>
                  </table>
                  <div className="px-4 sm:hidden">
                    <TransactionRowMobile
                      id={item.transaction.id}
                      description={item.transaction.description}
                      amount={item.transaction.amount}
                      type={item.transaction.type}
                      occurredAt={item.transaction.occurredAt}
                      accountName={item.transaction.accountName}
                      categoryId={item.transaction.categoryId ?? undefined}
                      categoryName={item.transaction.categoryName ?? undefined}
                      categories={categories}
                      installmentLabel={
                        item.transaction.installmentPlanId &&
                        item.transaction.installmentNumber
                          ? `${item.transaction.installmentNumber}/${installmentCountByPlanId.get(item.transaction.installmentPlanId) ?? '?'}`
                          : undefined
                      }
                      isRecurring={Boolean(item.transaction.recurringRuleId)}
                    />
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div ref={sentinelRef} className="h-px" aria-hidden />

      {isFetchingMore && (
        <div className="sm:hidden">
          <TransactionRowSkeletonMobile />
          <TransactionRowSkeletonMobile />
        </div>
      )}
      {isFetchingMore && (
        <table className="hidden w-full sm:table">
          <tbody>
            <TransactionRowSkeleton />
            <TransactionRowSkeleton />
            <TransactionRowSkeleton />
          </tbody>
        </table>
      )}
      {!hasMore && (
        <p className="text-muted-foreground py-4 text-center text-xs">
          Fim da lista.
        </p>
      )}
    </div>
  );
}
