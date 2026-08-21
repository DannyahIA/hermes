import { Skeleton } from '@/components/ui/skeleton';

/** Desktop table row shape — same column count as `TransactionRow`. */
export function TransactionRowSkeleton() {
  return (
    <tr className="border-border/70 border-b last:border-0">
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-20" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-40" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-24" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-24" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-16" />
      </td>
      <td className="px-4 py-3 text-right">
        <Skeleton className="ml-auto h-4 w-20" />
      </td>
      <td className="px-4 py-3" />
    </tr>
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
