import { AccountCard } from '@/app/accounts/account-card';
import { CreateAccountDialog } from '@/app/accounts/create-account-dialog';
import { AppShell } from '@/components/layout/app-shell';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
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
    .reduce((sum, { currentBalance }) => sum + currentBalance, 0);

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
        <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Contas
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Suas contas financeiras e seus saldos.
            </p>
          </div>
          <CreateAccountDialog />
        </section>

        <Card className="p-6">
          <CardHeader className="p-0">
            <CardTitle className="text-xl">Patrimônio total</CardTitle>
            <CardDescription>Soma das contas ativas.</CardDescription>
          </CardHeader>
          <CardContent className="mt-4 p-0">
            <p className="dimension-figure text-3xl font-semibold">
              {formatCurrency(total)}
            </p>
          </CardContent>
        </Card>

        {accounts.length === 0 ? (
          <EmptyState
            title="Nenhuma conta cadastrada."
            description="Crie sua primeira conta para começar a acompanhar suas finanças."
            action={<CreateAccountDialog />}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
