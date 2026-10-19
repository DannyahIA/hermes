import { beforeEach, describe, expect, it } from 'vitest';

import { Transaction } from '@/core/entities/transaction';
import { FakeTransactionRepository } from '@/tests/fakes/fake-transaction.repository';

import { GetTransactionPageUseCase } from './get-transaction-page.use-case';

const USER_ID = 'user-1';
const NOW = new Date(2026, 9, 19, 15, 30);

function transaction(
  id: string,
  occurredAt: Date,
  overrides: Partial<ConstructorParameters<typeof Transaction>[0]> = {},
) {
  return new Transaction({
    id,
    accountId: 'checking-1',
    description: id,
    amount: 10,
    type: 'expense',
    occurredAt,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

describe('GetTransactionPageUseCase', () => {
  let repository: FakeTransactionRepository;
  let useCase: GetTransactionPageUseCase;

  beforeEach(() => {
    repository = new FakeTransactionRepository();
    useCase = new GetTransactionPageUseCase(repository);
  });

  it('pages newest first and says where the next page starts', async () => {
    for (let day = 1; day <= 5; day += 1) {
      await repository.save(transaction(`tx-${day}`, new Date(2026, 9, day)));
    }

    const first = await useCase.execute({
      userId: USER_ID,
      filters: {},
      grouping: 'day',
      limit: 3,
      now: NOW,
    });
    expect(first.transactions.map((t) => t.id)).toEqual([
      'tx-5',
      'tx-4',
      'tx-3',
    ]);
    expect(first.next).toEqual({
      occurredAt: new Date(2026, 9, 3),
      id: 'tx-3',
    });

    const second = await useCase.execute({
      userId: USER_ID,
      filters: {},
      grouping: 'day',
      cursor: first.next ?? undefined,
      limit: 3,
      now: NOW,
    });
    expect(second.transactions.map((t) => t.id)).toEqual(['tx-2', 'tx-1']);
    expect(second.next).toBeNull();
  });

  it('stops at the end of today: what is scheduled is listed apart', async () => {
    await repository.save(transaction('today', new Date(2026, 9, 19, 23, 50)));
    await repository.save(transaction('tomorrow', new Date(2026, 9, 20)));
    await repository.save(transaction('installment', new Date(2026, 11, 8)));

    const page = await useCase.execute({
      userId: USER_ID,
      filters: {},
      grouping: 'day',
      limit: 50,
      now: NOW,
    });

    expect(page.transactions.map((t) => t.id)).toEqual(['today']);
  });

  it('totals each day on the page over all of its rows, not just those loaded', async () => {
    await repository.save(
      transaction('a', new Date(2026, 9, 18, 9), { amount: 30 }),
    );
    await repository.save(
      transaction('b', new Date(2026, 9, 18, 8), { amount: 20 }),
    );
    await repository.save(
      transaction('salary', new Date(2026, 9, 18, 7), {
        amount: 1000,
        type: 'income',
      }),
    );
    await repository.save(
      transaction('bill', new Date(2026, 9, 18, 6), {
        amount: 500,
        settlesAccountId: 'card-1',
      }),
    );
    await repository.save(
      transaction('to-savings', new Date(2026, 9, 18, 5), {
        amount: 200,
        type: 'transfer',
      }),
    );
    await repository.save(
      transaction('older', new Date(2026, 9, 10), { amount: 5 }),
    );

    const page = await useCase.execute({
      userId: USER_ID,
      filters: {},
      grouping: 'day',
      limit: 1,
      now: NOW,
    });

    expect(page.transactions.map((t) => t.id)).toEqual(['a']);
    // In minus out, leaving out the bill payment and the transfer.
    expect(page.totals).toEqual({ '2026-10-18': 950 });
  });

  it('totals by month and by category the same way, within the filters', async () => {
    await repository.save(
      transaction('market', new Date(2026, 9, 18), {
        amount: 120.5,
        categoryId: 'mercado',
      }),
    );
    await repository.save(
      transaction('market-sept', new Date(2026, 8, 3), {
        amount: 80,
        categoryId: 'mercado',
      }),
    );
    await repository.save(
      transaction('uber', new Date(2026, 9, 17), { amount: 18.9 }),
    );
    await repository.save(
      transaction('elsewhere', new Date(2026, 9, 16), {
        accountId: 'card-1',
        amount: 999,
      }),
    );

    const byMonth = await useCase.execute({
      userId: USER_ID,
      filters: { accountId: 'checking-1' },
      grouping: 'month',
      limit: 1,
      now: NOW,
    });
    expect(byMonth.totals).toEqual({ '2026-10': -139.4 });

    const byCategory = await useCase.execute({
      userId: USER_ID,
      filters: { accountId: 'checking-1' },
      grouping: 'category',
      limit: 2,
      now: NOW,
    });
    expect(byCategory.totals).toEqual({ mercado: -200.5, none: -18.9 });
  });

  it('honours a period that ends before today and one that is still to come', async () => {
    await repository.save(transaction('sept', new Date(2026, 8, 30)));
    await repository.save(transaction('oct', new Date(2026, 9, 1)));
    await repository.save(transaction('nov', new Date(2026, 10, 5)));

    const september = await useCase.execute({
      userId: USER_ID,
      filters: {
        from: new Date(2026, 8, 1),
        to: new Date(2026, 8, 30, 23, 59, 59, 999),
      },
      grouping: 'day',
      limit: 50,
      now: NOW,
    });
    expect(september.transactions.map((t) => t.id)).toEqual(['sept']);

    const november = await useCase.execute({
      userId: USER_ID,
      filters: { from: new Date(2026, 10, 1) },
      grouping: 'day',
      limit: 50,
      now: NOW,
    });
    expect(november).toEqual({ transactions: [], next: null, totals: {} });
  });
});
