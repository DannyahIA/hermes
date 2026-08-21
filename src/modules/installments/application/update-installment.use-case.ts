import type { AccountRepository } from '@/core/contracts/account-repository';
import type { InstallmentPlanRepository } from '@/core/contracts/installment-plan-repository';
import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import { Transaction } from '@/core/entities/transaction';
import { NotFoundError } from '@/core/errors/not-found-error';

export interface UpdateInstallmentInput {
  /** The transaction id of the installment being edited. */
  id: string;
  userId: string;
  description?: string;
  amount?: number;
  categoryId?: string;
  occurredAt?: Date;
  /**
   * When true, every later installment in the same plan is also updated to
   * the new amount — e.g. correcting an amount that should apply from here
   * forward, without touching installments that already occurred.
   */
  propagateToFuture: boolean;
}

/**
 * Edits a single installment transaction, optionally propagating an amount
 * change to every later installment in the same plan (calendar-app style:
 * "this one" vs. "this and future ones"). Only transactions created by
 * `CreateInstallmentPlanUseCase` (i.e. with an `installmentPlanId`) can be
 * edited here — a plain transaction should go through
 * `UpdateTransactionUseCase` instead.
 */
export class UpdateInstallmentUseCase {
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly accountRepository: AccountRepository,
    private readonly installmentPlanRepository: InstallmentPlanRepository,
  ) {}

  async execute(input: UpdateInstallmentInput): Promise<Transaction> {
    const transaction = await this.transactionRepository.findById(input.id);
    if (!transaction || !transaction.installmentPlanId) {
      throw new NotFoundError('Installment', input.id);
    }

    const plan = await this.installmentPlanRepository.findById(
      transaction.installmentPlanId,
    );
    if (!plan || plan.userId !== input.userId) {
      throw new NotFoundError('Installment', input.id);
    }

    let account = await this.accountRepository.findById(transaction.accountId);
    if (!account || account.userId !== input.userId) {
      throw new NotFoundError('Installment', input.id);
    }

    const updated = new Transaction({
      ...transaction.props,
      description: input.description ?? transaction.description,
      amount: input.amount ?? transaction.amount,
      categoryId: input.categoryId ?? transaction.categoryId,
      occurredAt: input.occurredAt ?? transaction.occurredAt,
      updatedAt: new Date(),
    });

    if (updated.amount !== transaction.amount) {
      account = account.withBalanceDelta(
        account.deltaFor('expense', updated.amount - transaction.amount),
      );
    }

    const toSave: Transaction[] = [updated];

    if (
      input.propagateToFuture &&
      input.amount !== undefined &&
      transaction.installmentNumber
    ) {
      const siblings = await this.transactionRepository.findByInstallmentPlanId(
        plan.id,
      );
      const future = siblings.filter(
        (sibling) =>
          sibling.id !== transaction.id &&
          (sibling.installmentNumber ?? 0) > transaction.installmentNumber!,
      );

      for (const sibling of future) {
        if (sibling.amount === input.amount) continue;

        account = account.withBalanceDelta(
          account.deltaFor('expense', input.amount - sibling.amount),
        );
        toSave.push(
          new Transaction({
            ...sibling.props,
            amount: input.amount,
            updatedAt: new Date(),
          }),
        );
      }
    }

    await this.accountRepository.save(account);
    for (const item of toSave) {
      await this.transactionRepository.save(item);
    }

    return updated;
  }
}
