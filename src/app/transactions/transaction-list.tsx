'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { useMemo, useRef } from 'react';

import {
  TRANSACTION_ROW_GRID_TEMPLATE,
  TransactionRow,
} from '@/app/transactions/transaction-row';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { groupTransactionsByPeriod } from '@/shared/lib/group-transactions-by-period';

interface TransactionListProps {
  initial: { transactions: ClientTransaction[]; nextCursor: string | null };
  filters: InfiniteTransactionFilters;
  categories: Array<{ id: string; name: string }>;
  installmentCountByPlanId: Record<string, number>;
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
  const {
    transactions,
    isFetchingMore,
    hasMore,
    error,
    loadMore,
    sentinelRef,
  } = useInfiniteTransactions(initial, filters);

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
    <div>
      {/* Desktop column header — rendered once, outside the virtualized
          scroll area, so it's always visible and shares the exact same
          column widths (TRANSACTION_ROW_GRID_TEMPLATE) as every row below
          it. Not a virtualized item: a real header. */}
      <div
        role="row"
        className="text-muted-foreground border-border/70 hidden border-b text-xs font-semibold tracking-wide uppercase sm:grid"
        style={{ gridTemplateColumns: TRANSACTION_ROW_GRID_TEMPLATE }}
      >
        <div role="columnheader" className="px-4 py-2">
          Data
        </div>
        <div role="columnheader" className="px-4 py-2">
          Descrição
        </div>
        <div role="columnheader" className="px-4 py-2">
          Conta
        </div>
        <div role="columnheader" className="px-4 py-2">
          Categoria
        </div>
        <div role="columnheader" className="px-4 py-2">
          Tipo
        </div>
        <div role="columnheader" className="px-4 py-2 text-right">
          Valor
        </div>
        <div role="columnheader" className="px-4 py-2" aria-hidden />
      </div>

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
                    <div className="hidden sm:block">
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
                            ? `${item.transaction.installmentNumber}/${installmentCountByPlanId[item.transaction.installmentPlanId] ?? '?'}`
                            : undefined
                        }
                        isRecurring={Boolean(item.transaction.recurringRuleId)}
                      />
                    </div>
                    <div className="px-4 sm:hidden">
                      <TransactionRowMobile
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
                            ? `${item.transaction.installmentNumber}/${installmentCountByPlanId[item.transaction.installmentPlanId] ?? '?'}`
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

        {error ? (
          <div className="px-4 py-3">
            <Alert variant="error">
              <AlertDescription className="flex items-center justify-between gap-3">
                <span>{error}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void loadMore()}
                >
                  Tentar novamente
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <>
            {isFetchingMore && (
              <div className="sm:hidden">
                <TransactionRowSkeletonMobile />
                <TransactionRowSkeletonMobile />
              </div>
            )}
            {isFetchingMore && (
              <div className="hidden sm:block">
                <TransactionRowSkeleton />
                <TransactionRowSkeleton />
                <TransactionRowSkeleton />
              </div>
            )}
            {!hasMore && (
              <p className="text-muted-foreground py-4 text-center text-xs">
                Fim da lista.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
