import Link from 'next/link';

import { AccountList } from '@/app/accounts/account-list';
import { BudgetsTab } from '@/app/accounts/budgets-tab';
import { CreateAccountDialog } from '@/app/accounts/create-account-dialog';
import { LoansTab } from '@/app/accounts/loans-tab';
import { MoneySummary } from '@/app/accounts/money-summary';
import { MONEY_TABS, readMoneyTab } from '@/app/accounts/money-tabs';
import { AppShell } from '@/components/layout/app-shell';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/routes';
import { requireCurrentUserId } from '@/infra/auth/session';
import { DrizzleAccountRepository } from '@/infra/repositories/drizzle-account.repository';
import { DrizzleTransactionRepository } from '@/infra/repositories/drizzle-transaction.repository';
import { GetMoneyOverviewUseCase } from '@/modules/accounts/application/get-money-overview.use-case';
import {
  TAB_LIST_CLASSES,
  tabLinkClasses,
} from '@/shared/constants/tab-styles';

interface AccountsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Meu Dinheiro: the summary and the accounts, then budgets and loans on
 * tabs (`?aba=`). /budgets and /loans redirect here.
 */
export default async function AccountsPage({
  searchParams,
}: AccountsPageProps) {
  const userId = await requireCurrentUserId();
  const tab = readMoneyTab(await searchParams);
  const now = new Date();

  const overview = await new GetMoneyOverviewUseCase(
    new DrizzleAccountRepository(),
    new DrizzleTransactionRepository(),
  ).execute(userId, now);
  const hasAccounts = overview.groups.length > 0 || overview.tucked.length > 0;

  return (
    <AppShell>
      <div className="space-y-8">
        <PageHeader
          title="Meu Dinheiro"
          description="Suas contas, cartões e reservas, com orçamentos e empréstimos."
          actions={<CreateAccountDialog />}
        />

        {hasAccounts ? (
          <>
            <MoneySummary
              checking={overview.checking}
              cards={overview.cards}
              savings={overview.savings}
              installmentsThisMonth={overview.installmentsThisMonth}
            />
            <AccountList groups={overview.groups} tucked={overview.tucked} />
          </>
        ) : (
          <EmptyState
            title="Nenhuma conta cadastrada."
            description="Crie sua primeira conta para começar a acompanhar suas finanças."
            action={<CreateAccountDialog />}
          />
        )}

        <div className="space-y-4">
          <nav
            aria-label="Orçamentos e empréstimos"
            className={TAB_LIST_CLASSES}
          >
            {MONEY_TABS.map((item) => (
              <Link
                key={item.id}
                href={`${ROUTES.accounts}?aba=${item.id}`}
                aria-current={tab === item.id ? 'page' : undefined}
                className={tabLinkClasses(tab === item.id)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          {tab === 'orcamentos' ? (
            <BudgetsTab userId={userId} now={now} />
          ) : (
            <LoansTab userId={userId} now={now} />
          )}
        </div>
      </div>
    </AppShell>
  );
}
