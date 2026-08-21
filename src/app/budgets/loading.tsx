import { CardSkeleton } from '@/components/ui/card-skeleton';

export default function Loading() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <CardSkeleton key={index} lines={3} />
      ))}
    </div>
  );
}
