import { randomUUID } from 'node:crypto';

import type { AccountRepository } from '@/core/contracts/account-repository';
import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import { Transaction } from '@/core/entities/transaction';
import { DomainError } from '@/core/errors/domain-error';
import { NotFoundError } from '@/core/errors/not-found-error';

export interface PayCreditCardBillInput {
  userId: string;
  creditAccountId: string;
  payingAccountId: string;
  amount: number;
  description?: string;
}

/**
 * Paying a credit card bill is a real cash outflow from the paying account
 * (a `checking`/`savings` account) *and* a reduction of the debt owed on
 * the credit account — but per domain.md's taxonomy it is neither an
 * income/expense pair nor a transfer (a transfer moves the same money
 * between two cash accounts; here the credit account's "balance" isn't
 * cash, it's a debt figure). So only ONE `Transaction` row is recorded —
 * the real expense on the paying account — while the credit account's
 * owed balance is adjusted directly via `withBalanceDelta`, with no second
 * transaction row invented to represent "debt paid off".
 */
export class PayCreditCardBillUseCase {
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly accountRepository: AccountRepository,
  ) {}

  async execute(input: PayCreditCardBillInput): Promise<Transaction> {
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new DomainError(
        'O valor do pagamento deve ser maior que zero.',
        'INVALID_AMOUNT',
      );
    }

    const [creditAccount, payingAccount] = await Promise.all([
      this.accountRepository.findById(input.creditAccountId),
      this.accountRepository.findById(input.payingAccountId),
    ]);

    if (!creditAccount || creditAccount.userId !== input.userId) {
      throw new NotFoundError('Account', input.creditAccountId);
    }
    if (!payingAccount || payingAccount.userId !== input.userId) {
      throw new NotFoundError('Account', input.payingAccountId);
    }

    if (creditAccount.type !== 'credit') {
      throw new DomainError(
        'Só é possível pagar a fatura de um cartão de crédito.',
        'NOT_A_CREDIT_ACCOUNT',
      );
    }
    if (payingAccount.type === 'credit') {
      throw new DomainError(
        'A conta de pagamento não pode ser outro cartão de crédito.',
        'PAYING_ACCOUNT_IS_CREDIT',
      );
    }

    // Overpaying (amount > what's currently owed) is allowed — credit card
    // bills can legitimately be overpaid, leaving a credit balance for the
    // next cycle — so no upper bound is enforced here.

    const now = new Date();
    const transaction = new Transaction({
      id: randomUUID(),
      accountId: payingAccount.id,
      description: input.description?.trim() || 'Pagamento de fatura',
      amount: input.amount,
      type: 'expense',
      occurredAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const updatedPayingAccount = payingAccount.withBalanceDelta(
      payingAccount.deltaFor('expense', input.amount),
    );
    const updatedCreditAccount = creditAccount.withBalanceDelta(-input.amount);

    await this.accountRepository.save(updatedPayingAccount);
    await this.accountRepository.save(updatedCreditAccount);
    await this.transactionRepository.save(transaction);

    return transaction;
  }
}
