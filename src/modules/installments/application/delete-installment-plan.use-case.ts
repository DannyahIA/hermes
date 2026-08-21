import type { AccountRepository } from '@/core/contracts/account-repository';
import type { InstallmentPlanRepository } from '@/core/contracts/installment-plan-repository';
import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import { NotFoundError } from '@/core/errors/not-found-error';

export interface DeleteInstallmentPlanInput {
  id: string;
  userId: string;
}

/**
 * Cancels an installment plan: reverses every one of its installments'
 * effect on the account balance, then deletes the plan — the database's
 * `ON DELETE CASCADE` on `transactions.installment_plan_id` removes the
 * installment rows themselves.
 */
export class DeleteInstallmentPlanUseCase {
  constructor(
    private readonly installmentPlanRepository: InstallmentPlanRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly accountRepository: AccountRepository,
  ) {}

  async execute(input: DeleteInstallmentPlanInput): Promise<void> {
    const plan = await this.installmentPlanRepository.findById(input.id);
    if (!plan || plan.userId !== input.userId) {
      throw new NotFoundError('InstallmentPlan', input.id);
    }

    let account = await this.accountRepository.findById(plan.accountId);
    if (!account || account.userId !== input.userId) {
      throw new NotFoundError('InstallmentPlan', input.id);
    }

    const installments =
      await this.transactionRepository.findByInstallmentPlanId(plan.id);
    for (const installment of installments) {
      account = account.withBalanceDelta(
        -account.deltaFor('expense', installment.amount),
      );
    }

    await this.accountRepository.save(account);
    await this.installmentPlanRepository.delete(plan.id);
  }
}
