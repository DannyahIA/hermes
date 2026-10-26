'use client';

import Link from 'next/link';
import { useOptimistic, useTransition } from 'react';

import { Section, SectionHeader } from '@/components/ui/section';
import type { NewCategoryHint } from '@/modules/categories/domain/category-catalog';
import { showBudgetAlerts } from '@/shared/hooks/show-budget-alerts';
import { toast } from '@/shared/hooks/use-toast';
import { cn } from '@/shared/lib/cn';
import { formatCurrency } from '@/shared/lib/format-currency';

import {
  categorizeTransactionAction,
  fileUnderNewCategoryAction,
} from './actions';
import { type CategoryOption, CategoryPicker } from './category-picker';

export interface ReviewItem {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  /** Already formatted on the server: "Hoje, 12:41". */
  when: string;
  accountName: string;
  suggestions: CategoryOption[];
  /** A common category the user does not have yet, offered first. */
  newCategory?: NewCategoryHint;
}

interface ReviewQueueProps {
  items: ReviewItem[];
  total: number;
  categories: CategoryOption[];
  seeAllHref: string;
}

/**
 * Income and spending of the last 30 days still without a category (spec
 * 2026-10-17-inicio-hub-design.md §4.2). A tap files the row and it leaves
 * the list at once; if saving fails, it comes back with a toast.
 */
export function ReviewQueue({
  items,
  total,
  categories,
  seeAllHref,
}: ReviewQueueProps) {
  const [filed, markFiled] = useOptimistic(
    new Set<string>(),
    (current, id: string) => new Set(current).add(id),
  );
  const [, startTransition] = useTransition();

  const visible = items.filter((item) => !filed.has(item.id));
  const remaining = total - filed.size;

  function pick(item: ReviewItem, category: CategoryOption) {
    startTransition(async () => {
      markFiled(item.id);
      const result = await categorizeTransactionAction(item.id, category.id);
      if (!result.success) {
        toast({
          title: result.error ?? 'Não foi possível salvar a categoria.',
          variant: 'error',
        });
        return;
      }
      showBudgetAlerts(result.alerts);
    });
  }

  function create(item: ReviewItem, name: string, color?: string) {
    startTransition(async () => {
      markFiled(item.id);
      const result = await fileUnderNewCategoryAction({
        transactionIds: [item.id],
        name,
        color,
      });
      if (!result.success) {
        toast({ title: result.error, variant: 'error' });
        return;
      }
      showBudgetAlerts(result.alerts);
    });
  }

  return (
    <Section>
      <SectionHeader
        title="Para revisar"
        count={remaining > 0 ? remaining : undefined}
        description="Sem categoria nos últimos 30 dias. O que você escolher passa a ser sugerido nas próximas compras no mesmo lugar."
      />
      <div>
        {visible.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">
            Tudo classificado.
          </p>
        ) : (
          <ul>
            {visible.map((item) => (
              <li key={item.id} className="dimension-row block">
                <div className="flex items-baseline justify-between gap-3">
                  <p
                    className="min-w-0 truncate font-medium"
                    title={item.description}
                  >
                    {item.description}
                  </p>
                  <p
                    className={cn(
                      'dimension-figure shrink-0 whitespace-nowrap',
                      item.type === 'income'
                        ? 'text-success'
                        : 'text-destructive',
                    )}
                  >
                    {item.type === 'income' ? '+ ' : '− '}
                    {formatCurrency(item.amount)}
                  </p>
                </div>
                <p className="text-muted-foreground truncate text-xs">
                  {item.when}, {item.accountName}
                </p>
                <CategoryPicker
                  className="mt-2"
                  subject={item.description}
                  suggestions={item.suggestions}
                  categories={categories}
                  newCategory={item.newCategory}
                  onPick={(category) => pick(item, category)}
                  onCreate={(name, color) => create(item, name, color)}
                />
              </li>
            ))}
          </ul>
        )}
        {remaining > visible.length && (
          <Link
            href={seeAllHref}
            className="text-muted-foreground hover:text-foreground mt-2 inline-block py-1 text-sm underline-offset-4 hover:underline"
          >
            Ver todas ({remaining})
          </Link>
        )}
      </div>
    </Section>
  );
}
