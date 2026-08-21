import { beforeEach, describe, expect, it } from 'vitest';

import { Account } from '@/core/entities/account';
import { DomainError } from '@/core/errors/domain-error';
import { NotFoundError } from '@/core/errors/not-found-error';
import { FakeAccountRepository } from '@/tests/fakes/fake-account.repository';
import { FakeTransactionRepository } from '@/tests/fakes/fake-transaction.repository';

import { PayCreditCardBillUseCase } from './pay-credit-card-bill.use-case';

function makeAccount(overrides: Partial<Account['props']> = {}): Account {
  const now = new Date();
  return new Account({
    id: overrides.id ?? 'account-id',
    userId: overrides.userId ?? 'user-1',
    name: overrides.name ?? 'Conta',
    type: overrides.type ?? 'checking',
    balance: overrides.balance ?? 0,
    currency: overrides.currency ?? 'BRL',
    archived: overrides.archived ?? false,
    hidden: overrides.hidden ?? false,
    closingDay: overrides.closingDay,
    dueDay: overrides.dueDay,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  });
}

describe('PayCreditCardBillUseCase', () => {
  let accountRepository: FakeAccountRepository;
  let transactionRepository: FakeTransactionRepository;
  let useCase: PayCreditCardBillUseCase;

  beforeEach(() => {
    accountRepository = new FakeAccountRepository();
    transactionRepository = new FakeTransactionRepository();
    useCase = new PayCreditCardBillUseCase(
      transactionRepository,
      accountRepository,
    );
  });

  it('pays down the credit card bill from a cash account', async () => {
    const credit = makeAccount({
      id: 'credit-1',
      type: 'credit',
      balance: 500,
    });
    const checking = makeAccount({
      id: 'checking-1',
      type: 'checking',
      balance: 1000,
    });
    await accountRepository.save(credit);
    await accountRepository.save(checking);

    const transaction = await useCase.execute({
      userId: 'user-1',
      creditAccountId: 'credit-1',
      payingAccountId: 'checking-1',
      amount: 300,
    });

    const updatedChecking = await accountRepository.findById('checking-1');
    const updatedCredit = await accountRepository.findById('credit-1');

    expect(updatedChecking?.balance).toBe(700);
    expect(updatedCredit?.balance).toBe(200);
    expect(transaction.type).toBe('expense');
    expect(transaction.amount).toBe(300);
    expect(transaction.accountId).toBe('checking-1');
    expect(transaction.description).toBe('Pagamento de fatura');

    const transactions =
      await transactionRepository.findByAccountId('checking-1');
    expect(transactions).toHaveLength(1);
  });

  it('uses a custom description when given', async () => {
    const credit = makeAccount({
      id: 'credit-1',
      type: 'credit',
      balance: 500,
    });
    const checking = makeAccount({
      id: 'checking-1',
      type: 'checking',
      balance: 1000,
    });
    await accountRepository.save(credit);
    await accountRepository.save(checking);

    const transaction = await useCase.execute({
      userId: 'user-1',
      creditAccountId: 'credit-1',
      payingAccountId: 'checking-1',
      amount: 100,
      description: 'Fatura de agosto',
    });

    expect(transaction.description).toBe('Fatura de agosto');
  });

  it('rejects when the "credit" account is not actually a credit account', async () => {
    const notCredit = makeAccount({
      id: 'checking-1',
      type: 'checking',
      balance: 500,
    });
    const checking = makeAccount({
      id: 'checking-2',
      type: 'savings',
      balance: 1000,
    });
    await accountRepository.save(notCredit);
    await accountRepository.save(checking);

    await expect(
      useCase.execute({
        userId: 'user-1',
        creditAccountId: 'checking-1',
        payingAccountId: 'checking-2',
        amount: 100,
      }),
    ).rejects.toThrow(DomainError);
  });

  it('rejects when the paying account is itself a credit account', async () => {
    const credit = makeAccount({
      id: 'credit-1',
      type: 'credit',
      balance: 500,
    });
    const otherCredit = makeAccount({
      id: 'credit-2',
      type: 'credit',
      balance: 200,
    });
    await accountRepository.save(credit);
    await accountRepository.save(otherCredit);

    await expect(
      useCase.execute({
        userId: 'user-1',
        creditAccountId: 'credit-1',
        payingAccountId: 'credit-2',
        amount: 100,
      }),
    ).rejects.toThrow(DomainError);
  });

  it('rejects a non-positive amount', async () => {
    const credit = makeAccount({
      id: 'credit-1',
      type: 'credit',
      balance: 500,
    });
    const checking = makeAccount({
      id: 'checking-1',
      type: 'checking',
      balance: 1000,
    });
    await accountRepository.save(credit);
    await accountRepository.save(checking);

    await expect(
      useCase.execute({
        userId: 'user-1',
        creditAccountId: 'credit-1',
        payingAccountId: 'checking-1',
        amount: 0,
      }),
    ).rejects.toThrow(DomainError);

    await expect(
      useCase.execute({
        userId: 'user-1',
        creditAccountId: 'credit-1',
        payingAccountId: 'checking-1',
        amount: -50,
      }),
    ).rejects.toThrow(DomainError);
  });

  it('rejects accounts that do not belong to the requesting user', async () => {
    const credit = makeAccount({
      id: 'credit-1',
      userId: 'user-1',
      type: 'credit',
      balance: 500,
    });
    const checking = makeAccount({
      id: 'checking-1',
      userId: 'user-2',
      type: 'checking',
      balance: 1000,
    });
    await accountRepository.save(credit);
    await accountRepository.save(checking);

    await expect(
      useCase.execute({
        userId: 'user-1',
        creditAccountId: 'credit-1',
        payingAccountId: 'checking-1',
        amount: 100,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('allows overpaying the credit card bill', async () => {
    const credit = makeAccount({
      id: 'credit-1',
      type: 'credit',
      balance: 100,
    });
    const checking = makeAccount({
      id: 'checking-1',
      type: 'checking',
      balance: 1000,
    });
    await accountRepository.save(credit);
    await accountRepository.save(checking);

    await useCase.execute({
      userId: 'user-1',
      creditAccountId: 'credit-1',
      payingAccountId: 'checking-1',
      amount: 150,
    });

    const updatedCredit = await accountRepository.findById('credit-1');
    expect(updatedCredit?.balance).toBe(-50);
  });
});
