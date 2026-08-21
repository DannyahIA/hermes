import { randomUUID } from 'node:crypto';

import type { AccountRepository } from '@/core/contracts/account-repository';
import type { CategoryRepository } from '@/core/contracts/category-repository';
import type { InstallmentPlanRepository } from '@/core/contracts/installment-plan-repository';
import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import type { InstallmentPlan } from '@/core/entities/installment-plan';
import { Transaction } from '@/core/entities/transaction';
import { NotFoundError } from '@/core/errors/not-found-error';
import { CreateInstallmentPlanUseCase } from '@/modules/installments/application/create-installment-plan.use-case';

export interface CreateLoanInput {
  id: string;
  userId: string;
  description: string;
  /** The amount borrowed — disbursed in full to `disbursementAccountId`. */
  principal: number;
  /** Monthly decimal rate (0.02 = 2% a.m.). */
  monthlyInterestRate: number;
  installmentCount: number;
  disbursementAccountId: string;
  repaymentAccountId: string;
  /** When the first repayment installment is due. Defaults to now. */
  startDate?: Date;
}

export interface CreateLoanResult {
  plan: InstallmentPlan;
  disbursementTransaction: Transaction;
}

/**
 * A loan is two things at once: money received now (one `income`
 * transaction for the full principal on `disbursementAccountId`), and a
 * repayment schedule owed later (an `InstallmentPlan` of kind `'loan'`,
 * whose Price-system installments materialize as real `expense`
 * transactions on `repaymentAccountId` — see
 * `CreateInstallmentPlanUseCase`, reused here rather than reimplemented).
 * Both accounts may be the same account. Everything runs against
 * repositories bound to the same unit-of-work — see the caller in
 * `src/app/loans/actions.ts`.
 */
export class CreateLoanUseCase {
  private readonly createInstallmentPlanUseCase: CreateInstallmentPlanUseCase;

  constructor(
    private readonly installmentPlanRepository: InstallmentPlanRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly accountRepository: AccountRepository,
    private readonly categoryRepository: CategoryRepository,
  ) {
    this.createInstallmentPlanUseCase = new CreateInstallmentPlanUseCase(
      installmentPlanRepository,
      transactionRepository,
      accountRepository,
      categoryRepository,
    );
  }

  async execute(input: CreateLoanInput): Promise<CreateLoanResult> {
    const disbursementAccount = await this.accountRepository.findById(
      input.disbursementAccountId,
    );
    if (!disbursementAccount || disbursementAccount.userId !== input.userId) {
      throw new NotFoundError('Account', input.disbursementAccountId);
    }

    const repaymentAccount = await this.accountRepository.findById(
      input.repaymentAccountId,
    );
    if (!repaymentAccount || repaymentAccount.userId !== input.userId) {
      throw new NotFoundError('Account', input.repaymentAccountId);
    }

    const now = new Date();
    const disbursementTransaction = new Transaction({
      id: randomUUID(),
      accountId: disbursementAccount.id,
      description: input.description,
      amount: input.principal,
      type: 'income',
      occurredAt: input.startDate ?? now,
      createdAt: now,
      updatedAt: now,
    });

    const delta = disbursementAccount.deltaFor('income', input.principal);
    await this.accountRepository.save(
      disbursementAccount.withBalanceDelta(delta),
    );
    await this.transactionRepository.save(disbursementTransaction);

    const plan = await this.createInstallmentPlanUseCase.execute({
      id: input.id,
      userId: input.userId,
      accountId: input.repaymentAccountId,
      description: input.description,
      kind: 'loan',
      totalAmount: input.principal,
      installmentCount: input.installmentCount,
      interestRate: input.monthlyInterestRate,
      startDate: input.startDate,
      installmentIds: Array.from({ length: input.installmentCount }, () =>
        randomUUID(),
      ),
    });

    return { plan, disbursementTransaction };
  }
}
