import { describe, expect, it } from 'vitest';

import { Account } from '@/core/entities/account';
import { RecurringTransaction } from '@/core/entities/recurring-transaction';
import { FakeAccountRepository } from '@/tests/fakes/fake-account.repository';
import { FakeRecurringTransactionRepository } from '@/tests/fakes/fake-recurring-transaction.repository';
import { FakeTransactionRepository } from '@/tests/fakes/fake-transaction.repository';

import { GenerateDueOccurrencesUseCase } from './generate-due-occurrences.use-case';

const USER_ID = 'user-1';

function makeAccount(balance = 0) {
  return new Account({
    id: 'acc-1',
    userId: USER_ID,
    name: 'Conta',
    type: 'checking',
    balance,
    currency: 'BRL',
    archived: false,
    hidden: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeRule(
  overrides: Partial<
    ConstructorParameters<typeof RecurringTransaction>[0]
  > = {},
) {
  return new RecurringTransaction({
    id: 'rule-1',
    userId: USER_ID,
    accountId: 'acc-1',
    description: 'Internet',
    amount: 100,
    type: 'expense',
    dayRuleKind: 'fixed_day',
    dayRuleDay: 8,
    startDate: new Date(2026, 0, 1), // January 2026
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

describe('GenerateDueOccurrencesUseCase', () => {
  it('materializes one transaction per missing month and debits the account each time', async () => {
    const accountRepository = new FakeAccountRepository();
    await accountRepository.save(makeAccount(1000));
    const transactionRepository = new FakeTransactionRepository();
    const ruleRepository = new FakeRecurringTransactionRepository();
    await ruleRepository.save(makeRule());

    const useCase = new GenerateDueOccurrencesUseCase(
      ruleRepository,
      transactionRepository,
      accountRepository,
    );

    const generated = await useCase.execute(USER_ID, new Date(2026, 2, 15)); // through mid-March

    expect(generated).toBe(3); // Jan, Feb, Mar
    const account = await accountRepository.findById('acc-1');
    expect(account!.balance).toBe(700); // 1000 - 3*100

    const rule = await ruleRepository.findById('rule-1');
    expect(rule!.lastGeneratedThrough?.getMonth()).toBe(2); // March
  });

  it('generates nothing on a second call for the same date (idempotent)', async () => {
    const accountRepository = new FakeAccountRepository();
    await accountRepository.save(makeAccount(1000));
    const transactionRepository = new FakeTransactionRepository();
    const ruleRepository = new FakeRecurringTransactionRepository();
    await ruleRepository.save(makeRule());

    const useCase = new GenerateDueOccurrencesUseCase(
      ruleRepository,
      transactionRepository,
      accountRepository,
    );

    await useCase.execute(USER_ID, new Date(2026, 2, 15));
    const secondRun = await useCase.execute(USER_ID, new Date(2026, 2, 15));

    expect(secondRun).toBe(0);
    const account = await accountRepository.findById('acc-1');
    expect(account!.balance).toBe(700); // unchanged by the second call
  });

  it('skips an inactive rule', async () => {
    const accountRepository = new FakeAccountRepository();
    await accountRepository.save(makeAccount(1000));
    const transactionRepository = new FakeTransactionRepository();
    const ruleRepository = new FakeRecurringTransactionRepository();
    await ruleRepository.save(makeRule({ active: false }));

    const useCase = new GenerateDueOccurrencesUseCase(
      ruleRepository,
      transactionRepository,
      accountRepository,
    );

    const generated = await useCase.execute(USER_ID, new Date(2026, 2, 15));
    expect(generated).toBe(0);
  });
});
