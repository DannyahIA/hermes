'use client';

import { Search, SlidersHorizontal } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import { setViewPreferenceAction } from '@/app/transactions/preferences-actions';
import { Button } from '@/components/ui/button';
import type { TransactionViewMode } from '@/config/constants';
import type { TransactionGrouping } from '@/core/contracts/transaction-repository';
import { cn } from '@/shared/lib/cn';
import {
  activePeriod,
  describePeriod,
  PERIOD_PRESETS,
  type PeriodPreset,
  periodRange,
  type TransactionQuery,
  transactionSearch,
} from '@/shared/lib/transaction-query';

import { FilterChips } from './filter-chips';
import { FiltersDialog } from './filters-dialog';
import type { ListedPage, ListedScheduled } from './listed-transaction';
import { type ListCategory, TransactionList } from './transaction-list';
import type { AccountOption } from './transaction-row';

/** How long typing pauses before the search runs. */
const SEARCH_DELAY = 350;

interface TransactionsBrowserProps {
  query: TransactionQuery;
  viewMode: TransactionViewMode;
  grouping: TransactionGrouping;
  /** "2026-10-19", as the server reads it. */
  today: string;
  accounts: AccountOption[];
  categories: ListCategory[];
  initial: ListedPage;
  scheduled: ListedScheduled;
}

function chipClasses(pressed: boolean) {
  return cn(
    'focus-visible:ring-ring rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none',
    pressed
      ? 'border-primary bg-primary/10 text-primary'
      : 'border-border bg-background hover:bg-accent',
  );
}

/**
 * The statement's toolbar and list (spec 2026-10-17-inicio-hub-design.md
 * §5). Every filter lives in the address, so a filtered list can be
 * reloaded, shared or gone back to; while a new one loads, the old list
 * stays on screen, dimmed.
 */
export function TransactionsBrowser({
  query,
  viewMode,
  grouping,
  today,
  accounts,
  categories,
  initial,
  scheduled,
}: TransactionsBrowserProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [filters, setFilters] = useState<{ dates: boolean } | null>(null);

  const [year, month, date] = today.split('-').map(Number);
  const todayDate = new Date(year, month - 1, date);
  const period = activePeriod(query, todayDate);
  const filterCount = [query.accountId, query.categoryId, query.type].filter(
    Boolean,
  ).length;

  function navigate(
    changes: Partial<TransactionQuery>,
    { replace = false } = {},
  ) {
    const href = `${pathname}${transactionSearch(query, changes)}`;
    startTransition(() => {
      if (replace) router.replace(href);
      else router.push(href);
    });
  }

  function choosePeriod(preset: PeriodPreset | null) {
    navigate(
      preset
        ? periodRange(preset, todayDate)
        : { from: undefined, to: undefined },
    );
  }

  // The search runs as typing pauses, and right away on Enter.
  const [text, setText] = useState(query.q ?? '');
  const [sent, setSent] = useState(query.q ?? '');
  const timer = useRef<number | undefined>(undefined);
  const urlText = query.q ?? '';
  const [seen, setSeen] = useState(urlText);
  // Not while searches are in flight: an earlier one landing must not undo
  // what was typed since.
  if (urlText !== seen && !pending) {
    setSeen(urlText);
    // Back, forward or a link changed it.
    if (urlText !== sent) {
      setText(urlText);
      setSent(urlText);
    }
  }
  useEffect(() => () => window.clearTimeout(timer.current), []);

  function search(value: string) {
    window.clearTimeout(timer.current);
    const trimmed = value.trim();
    if (trimmed === sent) return;
    setSent(trimmed);
    navigate({ q: trimmed || undefined }, { replace: true });
  }

  return (
    <>
      <div className="bg-background/95 border-border sticky top-0 z-20 -mx-4 border-b px-4 py-2 backdrop-blur-sm sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <div className="sm:bg-card sm:border-border flex flex-col gap-3 sm:rounded-[var(--radius)] sm:border sm:p-3">
          <div className="flex items-center gap-2">
            <form
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                search(text);
              }}
              className="border-input bg-background focus-within:border-ring focus-within:ring-ring/20 flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border px-3 focus-within:ring-2"
            >
              <Search
                aria-hidden
                className="text-muted-foreground size-4 shrink-0"
              />
              <input
                type="search"
                name="q"
                value={text}
                onChange={(event) => {
                  const value = event.target.value;
                  setText(value);
                  window.clearTimeout(timer.current);
                  timer.current = window.setTimeout(
                    () => search(value),
                    SEARCH_DELAY,
                  );
                }}
                placeholder="Buscar"
                aria-label="Buscar na descrição"
                autoComplete="off"
                enterKeyHint="search"
                className="placeholder:text-muted-foreground/80 min-w-0 flex-1 bg-transparent text-base outline-none sm:text-sm"
              />
            </form>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFilters({ dates: false })}
              className="shrink-0 px-2.5 sm:px-3"
            >
              <SlidersHorizontal aria-hidden className="size-4" />
              <span className="sr-only sm:not-sr-only">Filtros</span>
              {filterCount > 0 && (
                <span className="bg-primary text-primary-foreground dimension-figure rounded-sm px-1.5 text-xs leading-5">
                  {filterCount}
                  <span className="sr-only">
                    {filterCount === 1 ? ' ativo' : ' ativos'}
                  </span>
                </span>
              )}
            </Button>

            <select
              aria-label="Período"
              value={period ?? 'all'}
              onChange={(event) => {
                const value = event.target.value;
                if (value === 'pick') setFilters({ dates: true });
                else if (value === 'all') choosePeriod(null);
                else if (value !== 'custom') {
                  choosePeriod(value as PeriodPreset);
                }
              }}
              className="border-input bg-background focus-visible:ring-ring h-9 max-w-[8.5rem] shrink-0 truncate rounded-md border px-2 text-sm focus-visible:ring-2 focus-visible:outline-none sm:hidden"
            >
              <option value="all">Todo o período</option>
              {PERIOD_PRESETS.map(({ preset, label }) => (
                <option key={preset} value={preset}>
                  {label}
                </option>
              ))}
              {period === 'custom' && (
                <option value="custom">
                  {describePeriod(query, todayDate)}
                </option>
              )}
              <option value="pick">Escolher datas…</option>
            </select>
          </div>

          <div className="hidden flex-wrap items-center gap-x-3 gap-y-2 sm:flex">
            <div
              role="group"
              aria-label="Período"
              className="flex flex-wrap items-center gap-1.5"
            >
              {PERIOD_PRESETS.map(({ preset, label }) => (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={period === preset}
                  onClick={() =>
                    choosePeriod(period === preset ? null : preset)
                  }
                  className={chipClasses(period === preset)}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={period === 'custom'}
                onClick={() =>
                  period === 'custom'
                    ? choosePeriod(null)
                    : setFilters({ dates: true })
                }
                className={chipClasses(period === 'custom')}
              >
                {period === 'custom'
                  ? describePeriod(query, todayDate)
                  : 'Personalizado'}
              </button>
            </div>
            {filterCount > 0 && (
              <span aria-hidden className="bg-border h-4 w-px" />
            )}
            <FilterChips
              accounts={accounts}
              categories={categories}
              query={query}
              onRemove={navigate}
            />
          </div>
        </div>
      </div>

      <FilterChips
        className="sm:hidden"
        accounts={accounts}
        categories={categories}
        query={query}
        onRemove={navigate}
      />

      <TransactionList
        key={`${transactionSearch(query)}|${grouping}`}
        initial={initial}
        scheduled={scheduled}
        query={query}
        grouping={grouping}
        today={today}
        accounts={accounts}
        categories={categories}
        filtered={transactionSearch(query) !== ''}
        pending={pending}
      />

      <FiltersDialog
        open={filters !== null}
        onOpenChange={(open) => {
          if (!open) setFilters(null);
        }}
        focusDates={filters?.dates ?? false}
        query={query}
        accounts={accounts}
        categories={categories.filter(
          (category) => !category.archived || category.id === query.categoryId,
        )}
        onApply={navigate}
        viewMode={viewMode}
        onViewModeChange={(mode) =>
          startTransition(async () => {
            await setViewPreferenceAction('transactions', mode);
          })
        }
      />
    </>
  );
}
