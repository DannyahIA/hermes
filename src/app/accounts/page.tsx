import { AccountCard } from '@/app/accounts/account-card';
import { CreateAccountDialog } from '@/app/accounts/create-account-dialog';
import { AppShell } from '@/components/layout/app-shell';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { netWorthContribution } from '@/core/value-objects/net-worth';
import { requireCurrentUserId } from '@/infra/auth/session';
import { DrizzleAccountRepository } from '@/infra/repositories/drizzle-account.repository';
import { DrizzleTransactionRepository } from '@/infra/repositories/drizzle-transaction.repository';
import { GetAccountsUseCase } from '@/modules/accounts/application/get-accounts.use-case';
import { formatCurrency } from '@/shared/lib/format-currency';
import { formatDate } from '@/shared/lib/format-date';

export default async function AccountsPage() {
  const userId = await requireCurrentUserId();
  const accountsWithBalances = await new GetAccountsUseCase(
    new DrizzleAccountRepository(),
    new DrizzleTransactionRepository(),
  ).execute(userId);
  const accounts = accountsWithBalances.map(({ account }) => account);

  const total = accountsWithBalances
    .filter(({ account }) => !account.hidden && !account.archived)
    .reduce(
      (sum, { account, currentBalance }) =>
        sum + netWorthContribution(account, currentBalance),
      0,
    );

  // Client Components can only receive plain objects — entity class
  // instances aren't serializable — so `nextDueDate` is computed here and
  // handed down as a formatted string, and the paying-account options are
  // reduced to the plain `{ id, name }` shape each card needs.
  const now = new Date();
  const payingAccounts = accounts
    .filter((account) => account.type !== 'credit' && !account.archived)
    .map((account) => ({ id: account.id, name: account.name }));

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Contas"
          description="Suas contas financeiras e seus saldos."
          actions={<CreateAccountDialog />}
        />

        <div className="border-border border-b pb-6">
          <p className="text-muted-foreground text-sm">
            Patrimônio total, soma das contas ativas
          </p>
          <p className="dimension-figure text-headline mt-1 font-semibold">
            {formatCurrency(total)}
          </p>
        </div>

        {accounts.length === 0 ? (
          <EmptyState
            title="Nenhuma conta cadastrada."
            description="Crie sua primeira conta para começar a acompanhar suas finanças."
            action={<CreateAccountDialog />}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {accountsWithBalances.map(
              ({ account, currentBalance, projectedBalance }) => {
                const nextDue = account.nextDueDate(now);
                return (
                  <AccountCard
                    key={account.id}
                    id={account.id}
                    name={account.name}
                    type={account.type}
                    balance={currentBalance}
                    projectedBalance={
                      projectedBalance !== currentBalance
                        ? projectedBalance
                        : undefined
                    }
                    currency={account.currency}
                    archived={account.archived}
                    closingDay={account.closingDay}
                    dueDay={account.dueDay}
                    nextDueLabel={nextDue ? formatDate(nextDue) : undefined}
                    payingAccounts={payingAccounts}
                  />
                );
              },
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
