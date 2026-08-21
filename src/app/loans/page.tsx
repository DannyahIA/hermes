import Link from 'next/link';

import { LoanCard } from '@/app/loans/loan-card';
import { LoanForm } from '@/app/loans/loan-form';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { requireCurrentUserId } from '@/infra/auth/session';
import { DrizzleAccountRepository } from '@/infra/repositories/drizzle-account.repository';
import { DrizzleInstallmentPlanRepository } from '@/infra/repositories/drizzle-installment-plan.repository';
import { DrizzleTransactionRepository } from '@/infra/repositories/drizzle-transaction.repository';
import { GetAccountsUseCase } from '@/modules/accounts/application/get-accounts.use-case';
import { GetInstallmentPlansUseCase } from '@/modules/installments/application/get-installment-plans.use-case';

export default async function LoansPage() {
  const userId = await requireCurrentUserId();

  const accountRepository = new DrizzleAccountRepository();
  const transactionRepository = new DrizzleTransactionRepository();

  const [accountsWithBalances, plans] = await Promise.all([
    new GetAccountsUseCase(accountRepository, transactionRepository).execute(
      userId,
    ),
    new GetInstallmentPlansUseCase(
      new DrizzleInstallmentPlanRepository(),
    ).execute(userId),
  ]);
  const accounts = accountsWithBalances.map(({ account }) => account);

  const loans = plans.filter((plan) => plan.kind === 'loan');
  const accountById = new Map(accounts.map((account) => [account.id, account]));

  const now = new Date();
  const loanCards = await Promise.all(
    loans.map(async (loan) => {
      const installments = await transactionRepository.findByInstallmentPlanId(
        loan.id,
      );
      const paidCount = installments.filter((i) => i.occurredAt <= now).length;
      const currency = accountById.get(loan.accountId)?.currency ?? 'BRL';

      return {
        id: loan.id,
        description: loan.description,
        principal: loan.totalAmount,
        monthlyInterestRate: loan.interestRate ?? 0,
        installmentCount: loan.installmentCount,
        paidCount,
        currency,
      };
    }),
  );

  // Client Components can only receive plain objects, not entity class
  // instances — map before crossing the boundary.
  const accountOptions = accounts.map((account) => ({
    id: account.id,
    name: account.name,
  }));

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Empréstimos
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Registre um empréstimo recebido e acompanhe o cronograma de
              pagamento pelo sistema Price.
            </p>
          </div>
        </section>

        <section id="novo-emprestimo">
          <Card className="border-border/70 bg-card/80 p-6">
            <CardHeader className="p-0">
              <CardTitle>Novo empréstimo</CardTitle>
              <CardDescription>
                Escolha as contas de recebimento e pagamento, o valor e a taxa
                de juros mensal.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-4 p-0">
              <LoanForm accounts={accountOptions} />
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4">
          {loanCards.length === 0 ? (
            <Card className="border-border/70 bg-card/80 p-10 text-center">
              <p className="text-lg font-semibold">
                Nenhum empréstimo cadastrado.
              </p>
              <p className="text-muted-foreground mt-2 text-sm">
                Crie seu primeiro empréstimo para acompanhar o cronograma de
                pagamento.
              </p>
              {accountOptions.length > 0 ? (
                <Button className="mt-4" asChild>
                  <Link href="#novo-emprestimo">Criar primeiro empréstimo</Link>
                </Button>
              ) : null}
            </Card>
          ) : (
            loanCards.map((loan) => <LoanCard key={loan.id} {...loan} />)
          )}
        </section>
      </div>
    </AppShell>
  );
}
