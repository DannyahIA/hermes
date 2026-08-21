import { randomUUID } from 'node:crypto';

import type { AccountRepository } from '@/core/contracts/account-repository';
import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import { Transaction } from '@/core/entities/transaction';
import { DomainError } from '@/core/errors/domain-error';
import { NotFoundError } from '@/core/errors/not-found-error';

export interface TransferMoneyInput {
  userId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  description: string;
  occurredAt?: Date;
}

/**
 * A transfer never changes net worth (domain.md: "Nunca altera o
 * patrimônio. Apenas move saldo entre contas.") — it debits one account and
 * credits another by the same amount, recorded as two linked `transfer`
 * legs. Both accounts and both transaction rows must be written inside the
 * same unit-of-work transaction by the caller.
 */
export class TransferMoneyUseCase {
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly accountRepository: AccountRepository,
  ) {}

  async execute(
    input: TransferMoneyInput,
  ): Promise<[Transaction, Transaction]> {
    if (input.fromAccountId === input.toAccountId) {
      throw new DomainError(
        'A transfer requires two different accounts.',
        'SAME_ACCOUNT',
      );
    }

    const [fromAccount, toAccount] = await Promise.all([
      this.accountRepository.findById(input.fromAccountId),
      this.accountRepository.findById(input.toAccountId),
    ]);

    if (!fromAccount || fromAccount.userId !== input.userId) {
      throw new NotFoundError('Account', input.fromAccountId);
    }
    if (!toAccount || toAccount.userId !== input.userId) {
      throw new NotFoundError('Account', input.toAccountId);
    }

    const occurredAt = input.occurredAt ?? new Date();
    const now = new Date();

    const outgoing = new Transaction({
      id: randomUUID(),
      accountId: fromAccount.id,
      description: input.description,
      amount: input.amount,
      type: 'transfer',
      occurredAt,
      createdAt: now,
      updatedAt: now,
    });
    const incoming = new Transaction({
      id: randomUUID(),
      accountId: toAccount.id,
      description: input.description,
      amount: input.amount,
      type: 'transfer',
      occurredAt,
      createdAt: now,
      updatedAt: now,
    });

    await this.accountRepository.save(
      fromAccount.withBalanceDelta(-input.amount),
    );
    await this.accountRepository.save(toAccount.withBalanceDelta(input.amount));
    await this.transactionRepository.save(outgoing);
    await this.transactionRepository.save(incoming);

    return [outgoing, incoming];
  }
}
