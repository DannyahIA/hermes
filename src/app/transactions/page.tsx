import Link from 'next/link';

import { GroupingSelect } from '@/app/transactions/grouping-select';
import {
  GROUPING_BY_VIEW_MODE,
  type ListedPage,
  type ListedScheduled,
} from '@/app/transactions/listed-transaction';
import {
  loadScheduled,
  loadTransactionPage,
} from '@/app/transactions/load-transaction-page';
import { RecurringTransactionFormDialog } from '@/app/transactions/recurring-transaction-form-dialog';
import {
  type RecurringRuleView,
  RecurringTransactionRow,
} from '@/app/transactions/recurring-transaction-row';
import { TransactionsBrowser } from '@/app/transactions/transactions-browser';
import { TransactionsMoreMenu } from '@/app/transactions/transactions-more-menu';
import { AppShell } from '@/components/layout/app-shell';
import {
  TRANSACTION_VIEW_MODES,
  type TransactionViewMode,
} from '@/config/constants';
import { ROUTES } from '@/config/routes';
import type { RecurringTransaction } from '@/core/entities/recurring-transaction';
import { occurrencesToGenerate } from '@/core/value-objects/recurrence';
import { requireCurrentUserId } from '@/infra/auth/session';
import { DrizzleAccountRepository } from '@/infra/repositories/drizzle-account.repository';
import { DrizzleCategoryRepository } from '@/infra/repositories/drizzle-category.repository';
import { DrizzleRecurringTransactionRepository } from '@/infra/repositories/drizzle-recurring-transaction.repository';
import { DrizzleViewPreferenceRepository } from '@/infra/repositories/drizzle-view-preference.repository';
import { GetViewPreferenceUseCase } from '@/modules/preferences/application/get-view-preference.use-case';
import { GetRecurringTransactionsUseCase } from '@/modules/recurring-transactions/application/get-recurring-transactions.use-case';
import { cn } from '@/shared/lib/cn';
import { toDateInput } from '@/shared/lib/local-day';
import {
  readTransactionQuery,
  transactionSearch,
} from '@/shared/lib/transaction-query';

/** Defends against a stored view-preference value written by a future
 * version of the app with a mode this version doesn't know, or genuinely
 * corrupted data — falls back to the default rather than trusting an
 * unsafe cast. */
function isTransactionViewMode(value: string): value is TransactionViewMode {
  return (TRANSACTION_VIEW_MODES as readonly string[]).includes(value);
}

type Tab = 'transactions' | 'recurring';

const RULE_LABELS: Record<RecurringTransaction['dayRuleKind'], string> = {
  fixed_day: 'Todo dia',
  first_business_day: 'Primeiro dia útil',
  last_business_day: 'Último dia útil',
};

const dayMonth = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'short',
});

/** When a rule writes its next transaction; null when paused or over. */
function nextOccurrence(rule: RecurringTransaction, now: Date): Date | null {
  if (!rule.active) return null;
  const endOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  );
  const horizon = new Date(now.getFullYear() + 1, now.getMonth(), 1);
  return (
    occurrencesToGenerate(rule.props, horizon).find(
      (date) => date > endOfToday,
    ) ?? null
  );
}

interface TransactionsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The statement (spec 2026-10-17-inicio-hub-design.md §5), with the
 * recurring rules on a second tab.
 *
 * No `loading.tsx` and no Suspense boundary around the content, on purpose:
 * on Next 16.2.10, with either one here, the re-render a Server Action sends
 * back (revalidatePath) never commits, so classifying, editing or deleting a
 * row would look like it did nothing until a reload.
 */
export default async function TransactionsPage({
  searchParams,
}: TransactionsPageProps) {
  const userId = await requireCurrentUserId();
  const params = await searchParams;
  const tab: Tab = params.tab === 'recurring' ? 'recurring' : 'transactions';
  const query = readTransactionQuery(params);
  const now = new Date();

  const [accounts, categories, rules, storedViewMode] = await Promise.all([
    new DrizzleAccountRepository().findByUserId(userId),
    new DrizzleCategoryRepository().findByUserId(userId),
    new GetRecurringTransactionsUseCase(
      new DrizzleRecurringTransactionRepository(),
    ).execute(userId),
    new GetViewPreferenceUseCase(new DrizzleViewPreferenceRepository()).execute(
      userId,
      'transactions',
      'chronological',
    ),
  ]);
  const viewMode = isTransactionViewMode(storedViewMode)
    ? storedViewMode
    : 'chronological';
  const grouping = GROUPING_BY_VIEW_MODE[viewMode];

  const accountOptions = accounts
    .map((account) => ({
      id: account.id,
      name: account.name,
      type: account.type,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const categoryOptions = categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      color: category.color,
      archived: category.archived,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  let page: ListedPage | null = null;
  let scheduled: ListedScheduled | null = null;
  if (tab === 'transactions' && accounts.length > 0) {
    [page, scheduled] = await Promise.all([
      loadTransactionPage(userId, { query, grouping, now }),
      loadScheduled(userId, query, now),
    ]);
  }

  const accountNames = new Map(
    accounts.map((account) => [account.id, account.name]),
  );
  const accountTypes = new Map(
    accounts.map((account) => [account.id, account.type]),
  );
  const categoriesById = new Map(
    categories.map((category) => [category.id, category]),
  );
  const ruleViews: RecurringRuleView[] = rules.map((rule) => {
    const next = nextOccurrence(rule, now);
    const category = rule.categoryId
      ? categoriesById.get(rule.categoryId)
      : undefined;
    return {
      id: rule.id,
      description: rule.description,
      amount: rule.amount,
      type: rule.type,
      rule:
        rule.dayRuleKind === 'fixed_day'
          ? `${RULE_LABELS.fixed_day} ${rule.dayRuleDay}`
          : RULE_LABELS[rule.dayRuleKind],
      accountName: accountNames.get(rule.accountId) ?? 'Conta removida',
      accountType: accountTypes.get(rule.accountId) ?? 'checking',
      category: category
        ? { name: category.name, color: category.color }
        : undefined,
      next: next ? dayMonth.format(next) : null,
      active: rule.active,
      ended: Boolean(rule.props.endDate && rule.props.endDate < now),
    };
  });

  const tabs: Array<{ id: Tab; label: string; href: string; count?: number }> =
    [
      { id: 'transactions', label: 'Transações', href: ROUTES.transactions },
      {
        id: 'recurring',
        label: 'Recorrências',
        href: `${ROUTES.transactions}?tab=recurring`,
        count: rules.length,
      },
    ];

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="border-border flex items-end justify-between gap-3 border-b">
          <nav aria-label="Transações e recorrências" className="flex gap-1">
            {tabs.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                aria-current={tab === item.id ? 'page' : undefined}
                className={cn(
                  '-mb-px flex items-baseline gap-2 rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors sm:px-4',
                  tab === item.id
                    ? 'border-primary text-primary'
                    : 'text-muted-foreground hover:text-foreground border-transparent',
                )}
              >
                {item.label}
                {item.count !== undefined && item.count > 0 && (
                  <span className="dimension-figure text-muted-foreground text-xs font-normal">
                    {item.count}
                  </span>
                )}
              </Link>
            ))}
          </nav>
          {tab === 'transactions' && accounts.length > 0 && (
            <div className="flex items-center gap-2 pb-2">
              <GroupingSelect value={viewMode} className="hidden sm:flex" />
              <TransactionsMoreMenu
                accounts={accountOptions}
                exportHref={`/api/transactions/export${transactionSearch(query)}`}
              />
            </div>
          )}
        </div>

        {accounts.length === 0 ? (
          <div className="sheet-surface px-6 py-12 text-center">
            <p className="font-medium">Nenhuma conta cadastrada.</p>
            <p className="text-muted-foreground mt-1 text-sm">
              {tab === 'transactions'
                ? 'Crie uma conta para registrar transações.'
                : 'Crie uma conta antes de configurar uma recorrência.'}
            </p>
            <Link
              href={ROUTES.accounts}
              className="bg-primary text-primary-foreground mt-4 inline-block rounded-md px-4 py-2 text-sm font-medium"
            >
              Criar conta
            </Link>
          </div>
        ) : tab === 'recurring' ? (
          <section
            aria-labelledby="recurring-heading"
            className="sheet-surface @container"
          >
            <header className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
              <div className="min-w-0">
                <h2
                  id="recurring-heading"
                  className="font-display text-base font-semibold"
                >
                  Recorrências
                </h2>
                <p className="text-muted-foreground text-sm">
                  Receitas e despesas que se repetem todo mês. Cada uma vira uma
                  transação no dia.
                </p>
              </div>
              <RecurringTransactionFormDialog
                accounts={accountOptions}
                categories={categoryOptions.filter(
                  (category) => !category.archived,
                )}
              />
            </header>
            {ruleViews.length === 0 ? (
              <p className="text-muted-foreground px-4 py-8 text-center text-sm">
                Nenhuma recorrência ainda. Salário, aluguel e assinaturas entram
                aqui uma vez e passam a ser lançados sozinhos.
              </p>
            ) : (
              <ul>
                {ruleViews.map((rule) => (
                  <RecurringTransactionRow key={rule.id} rule={rule} />
                ))}
              </ul>
            )}
          </section>
        ) : (
          page &&
          scheduled && (
            <TransactionsBrowser
              query={query}
              viewMode={viewMode}
              grouping={grouping}
              today={toDateInput(now)}
              accounts={accountOptions}
              categories={categoryOptions}
              initial={page}
              scheduled={scheduled}
            />
          )
        )}
      </div>
    </AppShell>
  );
}
