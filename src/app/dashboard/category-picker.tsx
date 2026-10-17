'use client';

import Link from 'next/link';

import { ROUTES } from '@/config/routes';
import { cn } from '@/shared/lib/cn';

export interface CategoryOption {
  id: string;
  name: string;
  color?: string;
}

interface CategoryPickerProps {
  /** What is being classified, for screen readers: "Padaria Real". */
  subject: string;
  suggestions: CategoryOption[];
  /** Every category that can receive transactions, for "Outra…". */
  categories: CategoryOption[];
  onPick: (category: CategoryOption) => void;
  className?: string;
}

export function CategoryDot({ color }: { color?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-2 shrink-0 rounded-full',
        !color && 'bg-muted-foreground/60',
      )}
      style={color ? { backgroundColor: color } : undefined}
    />
  );
}

/**
 * The suggested categories as one-tap buttons, then "Outra…" with every
 * category (spec 2026-10-17-inicio-hub-design.md §4.2).
 */
export function CategoryPicker({
  subject,
  suggestions,
  categories,
  onPick,
  className,
}: CategoryPickerProps) {
  if (categories.length === 0) {
    return (
      <p className={cn('text-muted-foreground text-sm', className)}>
        <Link href={ROUTES.categories} className="text-foreground underline">
          Crie uma categoria
        </Link>{' '}
        para classificar.
      </p>
    );
  }

  return (
    <div
      role="group"
      aria-label={`Categoria para ${subject}`}
      className={cn('flex flex-wrap items-center gap-2', className)}
    >
      {suggestions.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => onPick(category)}
          className="border-border bg-background hover:bg-accent focus-visible:ring-ring inline-flex h-8 max-w-full items-center gap-1.5 rounded-md border px-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <CategoryDot color={category.color} />
          <span className="truncate">{category.name}</span>
        </button>
      ))}
      {/* Fixed width: a select is as wide as its longest option, and the
          closed box only ever shows "Outra…". */}
      <select
        aria-label={
          suggestions.length > 0 ? 'Outra categoria' : 'Escolher categoria'
        }
        value=""
        onChange={(event) => {
          const category = categories.find(
            (option) => option.id === event.target.value,
          );
          if (category) onPick(category);
        }}
        className="border-border bg-background text-muted-foreground hover:bg-accent focus-visible:ring-ring h-8 w-36 max-w-full min-w-0 rounded-md border px-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <option value="" disabled>
          {suggestions.length > 0 ? 'Outra…' : 'Escolher categoria…'}
        </option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
    </div>
  );
}
