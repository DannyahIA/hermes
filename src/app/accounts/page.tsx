import { AccountCard } from '@/app/accounts/account-card';
import { AccountForm } from '@/app/accounts/account-form';
import { AppShell } from '@/components/layout/app-shell';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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

  const total = accounts
    .filter((account) => !account.hidden && !account.archived)
    .reduce((sum, account) => sum + account.balance, 0);

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
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="p-6">
            <CardHeader className="p-0">
              <CardTitle className="text-xl">Patrimônio total</CardTitle>
              <CardDescription>Soma das contas ativas.</CardDescription>
            </CardHeader>
            <CardContent className="mt-4 p-0">
              <p className="ledger-figure text-3xl font-semibold">
                {formatCurrency(total)}
              </p>
            </CardContent>
          </Card>

          {accounts.length === 0 ? (
            <Card className="flex flex-col items-center gap-2 p-12 text-center">
              <CardTitle>Nenhuma conta cadastrada.</CardTitle>
              <CardDescription>
                Crie sua primeira conta ao lado para começar.
              </CardDescription>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {accounts.map((account) => {
                const nextDue = account.nextDueDate(now);
                return (
                  <AccountCard
                    key={account.id}
                    id={account.id}
                    name={account.name}
                    type={account.type}
                    balance={account.balance}
                    currency={account.currency}
                    archived={account.archived}
                    closingDay={account.closingDay}
                    dueDay={account.dueDay}
                    nextDueLabel={nextDue ? formatDate(nextDue) : undefined}
                    payingAccounts={payingAccounts}
                  />
                );
              })}
            </div>
          )}
        </div>

        <Card className="h-fit p-6">
          <CardHeader className="p-0">
            <CardTitle>Nova conta</CardTitle>
            <CardDescription>Adicione uma conta financeira.</CardDescription>
          </CardHeader>
          <CardContent className="mt-4 p-0">
            <AccountForm />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
