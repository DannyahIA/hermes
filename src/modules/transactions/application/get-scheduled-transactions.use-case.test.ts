import { describe, expect, it } from 'vitest';

import { Transaction } from '@/core/entities/transaction';
import { FakeTransactionRepository } from '@/tests/fakes/fake-transaction.repository';

import { GetScheduledTransactionsUseCase } from './get-scheduled-transactions.use-case';

const NOW = new Date(2026, 9, 19, 15, 30);

function transaction(
  id: string,
  occurredAt: Date,
  overrides: Partial<ConstructorParameters<typeof Transaction>[0]> = {},
) {
  return new Transaction({
    id,
    accountId: 'card-1',
    description: id,
    amount: 100,
    type: 'expense',
    occurredAt,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

describe('GetScheduledTransactionsUseCase', () => {
  it('lists what falls after today, soonest first, with what it adds up to', async () => {
    const repository = new FakeTransactionRepository();
    await repository.save(transaction('today', new Date(2026, 9, 19, 23, 59)));
    await repository.save(transaction('dec', new Date(2026, 11, 8)));
    await repository.save(transaction('nov', new Date(2026, 10, 8)));
    await repository.save(
      transaction('refund', new Date(2026, 10, 1), {
        type: 'income',
        amount: 30,
      }),
    );

    const scheduled = await new GetScheduledTransactionsUseCase(
      repository,
    ).execute({ userId: 'user-1', filters: {}, now: NOW });

    expect(scheduled.transactions.map((t) => t.id)).toEqual([
      'refund',
      'nov',
      'dec',
    ]);
    expect(scheduled.net).toBe(-170);
  });

  it('keeps to the filters, and has nothing when the period ends by today', async () => {
    const repository = new FakeTransactionRepository();
    await repository.save(transaction('nov', new Date(2026, 10, 8)));
    await repository.save(
      transaction('nov-other', new Date(2026, 10, 9), { accountId: 'card-2' }),
    );
    const useCase = new GetScheduledTransactionsUseCase(repository);

    const onCard = await useCase.execute({
      userId: 'user-1',
      filters: { accountId: 'card-1' },
      now: NOW,
    });
    expect(onCard.transactions.map((t) => t.id)).toEqual(['nov']);

    const lastMonth = await useCase.execute({
      userId: 'user-1',
      filters: {
        from: new Date(2026, 8, 1),
        to: new Date(2026, 8, 30, 23, 59, 59, 999),
      },
      now: NOW,
    });
    expect(lastMonth).toEqual({ transactions: [], net: 0 });
  });
});
