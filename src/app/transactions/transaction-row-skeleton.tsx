import { TRANSACTION_ROW_GRID_TEMPLATE } from '@/app/transactions/transaction-row';
import { Skeleton } from '@/components/ui/skeleton';

/** Desktop grid row shape — same columns (and shared grid template) as
 * `TransactionRow`, so loading skeletons line up with real rows. */
export function TransactionRowSkeleton() {
  return (
    <div
      role="row"
      className="border-border/70 grid items-center border-b last:border-0"
      style={{ gridTemplateColumns: TRANSACTION_ROW_GRID_TEMPLATE }}
    >
      <div role="cell" className="px-4 py-3">
        <Skeleton className="h-4 w-20" />
      </div>
      <div role="cell" className="px-4 py-3">
        <Skeleton className="h-4 w-40" />
      </div>
      <div role="cell" className="px-4 py-3">
        <Skeleton className="h-4 w-24" />
      </div>
      <div role="cell" className="px-4 py-3">
        <Skeleton className="h-4 w-24" />
      </div>
      <div role="cell" className="px-4 py-3">
        <Skeleton className="h-4 w-16" />
      </div>
      <div role="cell" className="px-4 py-3 text-right">
        <Skeleton className="ml-auto h-4 w-20" />
      </div>
      <div role="cell" className="px-4 py-3" />
    </div>
  );
}

/** Mobile stacked-card shape — same structure as `TransactionRowMobile`. */
export function TransactionRowSkeletonMobile() {
  return (
    <div className="ledger-row flex-col items-stretch gap-2 sm:hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="w-2/3 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-4 w-16 shrink-0" />
      </div>
    </div>
  );
}
