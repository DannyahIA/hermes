import { CreateLoanDialog } from '@/app/loans/create-loan-dialog';
import { LoanRow } from '@/app/loans/loan-card';
import { EmptyState } from '@/components/ui/empty-state';
import { Section, SectionHeader } from '@/components/ui/section';
import { DrizzleAccountRepository } from '@/infra/repositories/drizzle-account.repository';
import { DrizzleInstallmentPlanRepository } from '@/infra/repositories/drizzle-installment-plan.repository';
import { DrizzleTransactionRepository } from '@/infra/repositories/drizzle-transaction.repository';
import { GetInstallmentPlansUseCase } from '@/modules/installments/application/get-installment-plans.use-case';

/** The "Empréstimos" tab: each loan as a row, with what it costs, what is paid and what is left. */
export async function LoansTab({ userId, now }: { userId: string; now: Date }) {
  const transactionRepository = new DrizzleTransactionRepository();

  const [accounts, plans] = await Promise.all([
    new DrizzleAccountRepository().findByUserId(userId),
    new GetInstallmentPlansUseCase(
      new DrizzleInstallmentPlanRepository(),
    ).execute(userId),
  ]);

  const loans = plans.filter((plan) => plan.kind === 'loan');
  const accountById = new Map(accounts.map((account) => [account.id, account]));

  const loanRows = await Promise.all(
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
    <Section>
      <SectionHeader
        title="Empréstimos"
        description="Empréstimos recebidos e o cronograma de pagamento pelo sistema Price."
        action={
          accountOptions.length > 0 && loanRows.length > 0 ? (
            <CreateLoanDialog accounts={accountOptions} />
          ) : undefined
        }
      />
      {loanRows.length === 0 ? (
        <EmptyState
          title="Nenhum empréstimo cadastrado."
          description="Crie seu primeiro empréstimo para acompanhar o cronograma de pagamento."
          action={
            accountOptions.length > 0 ? (
              <CreateLoanDialog accounts={accountOptions} />
            ) : undefined
          }
        />
      ) : (
        <ul className="sheet-surface">
          {loanRows.map((loan) => (
            <LoanRow key={loan.id} {...loan} />
          ))}
        </ul>
      )}
    </Section>
  );
}
