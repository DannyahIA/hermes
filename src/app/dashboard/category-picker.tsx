'use client';

import { useState } from 'react';

import type { NewCategoryHint } from '@/modules/categories/domain/category-catalog';
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
  /** A common category the user does not have yet, offered before the suggestions. */
  newCategory?: NewCategoryHint;
  onPick: (category: CategoryOption) => void;
  /** Creates a category by name (or the offered one) and files the purchase under it. */
  onCreate: (name: string, color?: string) => void;
  className?: string;
}

/** The "＋ Nova categoria…" option: swaps the select for the name field. */
export const NEW_CATEGORY_OPTION = '__new__';

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
 * category (spec 2026-10-17-inicio-hub-design.md §4.2). A common category
 * the user does not have yet comes first, dashed; "Outra…" ends with
 * "＋ Nova categoria…", which asks for a name.
 */
export function CategoryPicker({
  subject,
  suggestions,
  categories,
  newCategory,
  onPick,
  onCreate,
  className,
}: CategoryPickerProps) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  // With no categories there is no select to go back to: the field shows.
  const showField = naming || categories.length === 0;
  const trimmed = name.trim();

  function back() {
    setNaming(false);
    setName('');
  }

  function create() {
    if (!trimmed) return;
    onCreate(trimmed, undefined);
  }

  return (
    <div
      role="group"
      aria-label={`Categoria para ${subject}`}
      className={cn('flex flex-wrap items-center gap-2', className)}
    >
      {newCategory && (
        <button
          type="button"
          onClick={() => onCreate(newCategory.name, newCategory.color)}
          className="border-border bg-background hover:bg-accent focus-visible:ring-ring inline-flex h-8 max-w-full items-center gap-1.5 rounded-md border border-dashed px-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <CategoryDot color={newCategory.color} />
          <span className="truncate">＋ {newCategory.name}</span>{' '}
          <span className="text-muted-foreground">(nova)</span>
        </button>
      )}
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
      {showField ? (
        <div className="flex items-center gap-2">
          <input
            aria-label="Nome da categoria"
            autoFocus
            maxLength={60}
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                // This picker can sit inside a form: Enter creates, never submits.
                event.preventDefault();
                create();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                if (categories.length > 0) back();
              }
            }}
            className="border-border bg-background focus-visible:ring-ring h-8 w-36 max-w-full min-w-0 rounded-md border px-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
          />
          <button
            type="button"
            disabled={!trimmed}
            onClick={create}
            className="border-border bg-background hover:bg-accent focus-visible:ring-ring h-8 shrink-0 rounded-md border px-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
          >
            Criar
          </button>
        </div>
      ) : (
        /* Fixed width: a select is as wide as its longest option, and the
          closed box only ever shows "Outra…". */
        <select
          aria-label={
            suggestions.length > 0 ? 'Outra categoria' : 'Escolher categoria'
          }
          value=""
          onChange={(event) => {
            if (event.target.value === NEW_CATEGORY_OPTION) {
              setNaming(true);
              return;
            }
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
          <option value={NEW_CATEGORY_OPTION}>＋ Nova categoria…</option>
        </select>
      )}
    </div>
  );
}
