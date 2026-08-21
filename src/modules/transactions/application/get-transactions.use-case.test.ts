import { describe, expect, it } from 'vitest';

import { Transaction } from '@/core/entities/transaction';
import { GetTransactionsUseCase } from '@/modules/transactions/application/get-transactions.use-case';
import { FakeTransactionRepository } from '@/tests/fakes/fake-transaction.repository';

function makeTransaction(
  overrides: Partial<ConstructorParameters<typeof Transaction>[0]> = {},
) {
  return new Transaction({
    id: overrides.id ?? crypto.randomUUID(),
    accountId: 'account-1',
    description: 'Test',
    amount: 10,
    type: 'expense',
    occurredAt: overrides.occurredAt ?? new Date('2026-06-01T00:00:00.000Z'),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

describe('GetTransactionsUseCase (cursor pagination)', () => {
  it('passes the cursor through to the repository filters unchanged', async () => {
    const repository = new FakeTransactionRepository();
    const cursor = {
      occurredAt: new Date('2026-06-10T00:00:00.000Z'),
      id: 'some-id',
    };
    let receivedFilters: unknown;
    repository.findByUserId = async (userId, filters) => {
      receivedFilters = filters;
      return [];
    };

    await new GetTransactionsUseCase(repository).execute('user-1', {
      cursor,
      pageSize: 50,
    });

    expect(receivedFilters).toMatchObject({ cursor, pageSize: 50 });
  });

  it('returns transactions ordered newest-first when no cursor is given', async () => {
    const repository = new FakeTransactionRepository();
    const older = makeTransaction({
      occurredAt: new Date('2026-06-01T00:00:00.000Z'),
    });
    const newer = makeTransaction({
      occurredAt: new Date('2026-06-10T00:00:00.000Z'),
    });
    await repository.save(older);
    await repository.save(newer);

    const result = await new GetTransactionsUseCase(repository).execute(
      'user-1',
      {},
    );

    expect(result.map((t) => t.id)).toEqual([newer.id, older.id]);
  });
});
