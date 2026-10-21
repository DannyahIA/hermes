import { beforeEach, describe, expect, it } from 'vitest';

import { Account } from '@/core/entities/account';
import { Category } from '@/core/entities/category';
import { MerchantRule } from '@/core/entities/merchant-rule';
import { WalletCard } from '@/core/entities/wallet-card';
import { FakeAccountRepository } from '@/tests/fakes/fake-account.repository';
import { FakeCaptureEventRepository } from '@/tests/fakes/fake-capture-event.repository';
import { FakeCategoryRepository } from '@/tests/fakes/fake-category.repository';
import { FakeMerchantRuleRepository } from '@/tests/fakes/fake-merchant-rule.repository';
import { FakeTransactionRepository } from '@/tests/fakes/fake-transaction.repository';
import { FakeWalletCardRepository } from '@/tests/fakes/fake-wallet-card.repository';

import {
  type CaptureDependencies,
  CaptureWalletPaymentUseCase,
  DiscardCaptureUseCase,
  ProvideCaptureAmountUseCase,
  ResolveWalletCardUseCase,
} from './capture-wallet-payment.use-case';

const USER_ID = 'user-1';
const NOW = new Date('2026-10-19T15:41:30.000Z');

function account(
  id: string,
  type: 'checking' | 'credit',
  overrides: Partial<ConstructorParameters<typeof Account>[0]> = {},
) {
  return new Account({
    id,
    userId: USER_ID,
    name: id,
    type,
    balance: 1000,
    currency: 'BRL',
    archived: false,
    hidden: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

function payment(overrides: Record<string, unknown> = {}) {
  return {
    amount: 'R$ 23,90',
    merchant: 'PADARIA REAL LTDA *123',
    card: 'Nubank',
    occurredAt: '2026-10-19T15:41:05.000Z',
    ...overrides,
  };
}

describe('capturing an Apple Pay payment', () => {
  let deps: CaptureDependencies;
  let accounts: FakeAccountRepository;
  let transactions: FakeTransactionRepository;
  let cards: FakeWalletCardRepository;
  let events: FakeCaptureEventRepository;
  let rules: FakeMerchantRuleRepository;
  let categories: FakeCategoryRepository;
  let capture: CaptureWalletPaymentUseCase;

  async function mapCard(name: string, accountId: string, alternate?: string) {
    await cards.save(
      new WalletCard({
        id: `card-${name}`,
        userId: USER_ID,
        walletName: name,
        nameKey: name.toLowerCase(),
        accountId,
        alternateAccountId: alternate,
        createdAt: NOW,
        updatedAt: NOW,
      }),
    );
  }

  beforeEach(async () => {
    accounts = new FakeAccountRepository();
    transactions = new FakeTransactionRepository();
    cards = new FakeWalletCardRepository();
    events = new FakeCaptureEventRepository();
    rules = new FakeMerchantRuleRepository();
    categories = new FakeCategoryRepository();
    deps = {
      captureEvents: events,
      walletCards: cards,
      merchantRules: rules,
      categories,
      accounts,
      transactions,
    };
    capture = new CaptureWalletPaymentUseCase(deps);
    await accounts.save(account('nubank-credito', 'credit', { balance: 0 }));
    await accounts.save(account('nubank-conta', 'checking'));
    await categories.save(
      new Category({
        id: 'restaurantes',
        userId: USER_ID,
        name: 'Restaurantes',
        archived: false,
        createdAt: NOW,
        updatedAt: NOW,
      }),
    );
  });

  it('records a credit purchase on the card, adding to what is owed', async () => {
    await mapCard('Nubank', 'nubank-credito');

    const result = await capture.execute({
      userId: USER_ID,
      payload: payment(),
      now: NOW,
    });

    expect(result).toMatchObject({ status: 'recorded', repeated: false });
    const recorded = await transactions.findById(result.transactionId!);
    expect(recorded).toMatchObject({
      accountId: 'nubank-credito',
      amount: 23.9,
      type: 'expense',
      description: 'Padaria Real',
      categoryId: undefined,
      source: 'wallet',
      occurredAt: new Date('2026-10-19T15:41:05.000Z'),
    });
    expect((await accounts.findById('nubank-credito'))?.balance).toBe(23.9);
  });

  it('takes a debit purchase out of the checking account', async () => {
    await mapCard('Nubank', 'nubank-conta');

    await capture.execute({ userId: USER_ID, payload: payment(), now: NOW });

    expect((await accounts.findById('nubank-conta'))?.balance).toBe(976.1);
  });

  it('files a known merchant under its category, by the name it was given', async () => {
    await mapCard('Nubank', 'nubank-credito');
    await rules.save(
      new MerchantRule({
        id: 'rule-1',
        userId: USER_ID,
        merchantKey: 'padaria real',
        displayName: 'Padaria Real (Batel)',
        categoryId: 'restaurantes',
        hits: 3,
        createdAt: NOW,
        updatedAt: NOW,
      }),
    );

    const result = await capture.execute({
      userId: USER_ID,
      payload: payment(),
      now: NOW,
    });

    expect(await transactions.findById(result.transactionId!)).toMatchObject({
      categoryId: 'restaurantes',
      description: 'Padaria Real (Batel)',
    });
  });

  it('answers a repeat with the first result, recording nothing more', async () => {
    await mapCard('Nubank', 'nubank-credito');
    const first = await capture.execute({
      userId: USER_ID,
      payload: payment(),
      now: NOW,
    });

    const again = await capture.execute({
      userId: USER_ID,
      payload: payment({
        amount: 23.9,
        occurredAt: '2026-10-19T15:41:50.000Z',
      }),
      now: NOW,
    });

    expect(again).toEqual({ ...first, repeated: true });
    expect(await transactions.findByUserId(USER_ID)).toHaveLength(1);
    expect((await accounts.findById('nubank-credito'))?.balance).toBe(23.9);
  });

  it('keeps a payment from a card it has not seen until the card gets an account', async () => {
    const waiting = await capture.execute({
      userId: USER_ID,
      payload: payment({ card: 'Itaú Visa' }),
      now: NOW,
    });

    expect(waiting).toMatchObject({ status: 'needs_account' });
    expect(await transactions.findByUserId(USER_ID)).toHaveLength(0);
    const [card] = await cards.findByUserId(USER_ID);
    expect(card).toMatchObject({
      walletName: 'Itaú Visa',
      nameKey: 'itau visa',
    });
    expect(card.accountId).toBeUndefined();

    const recorded = await new ResolveWalletCardUseCase(deps).execute({
      userId: USER_ID,
      walletCardId: card.id,
      accountId: 'nubank-credito',
      now: NOW,
    });

    expect(recorded).toEqual([waiting.captureId]);
    expect((await events.findById(waiting.captureId))?.status).toBe('recorded');
    expect(await transactions.findByUserId(USER_ID)).toHaveLength(1);
  });

  it('waits for the amount when the payment came without one', async () => {
    await mapCard('Nubank', 'nubank-credito');

    const waiting = await capture.execute({
      userId: USER_ID,
      payload: payment({ amount: '0' }),
      now: NOW,
    });
    expect(waiting.status).toBe('needs_amount');

    await new ProvideCaptureAmountUseCase(deps).execute({
      userId: USER_ID,
      captureId: waiting.captureId,
      amount: 41.5,
      now: NOW,
    });

    const event = await events.findById(waiting.captureId);
    expect(event?.status).toBe('recorded');
    expect(await transactions.findById(event!.transactionId!)).toMatchObject({
      amount: 41.5,
    });
  });

  it('names a payment with no merchant by its card', async () => {
    await mapCard('Nubank', 'nubank-credito');

    const result = await capture.execute({
      userId: USER_ID,
      payload: payment({ merchant: null }),
      now: NOW,
    });

    expect(
      (await transactions.findById(result.transactionId!))?.description,
    ).toBe('Compra no Nubank');
  });

  it('does not post to an archived account: the payment waits for another', async () => {
    await accounts.save(account('velha', 'credit', { archived: true }));
    await mapCard('Nubank', 'velha');

    const result = await capture.execute({
      userId: USER_ID,
      payload: payment(),
      now: NOW,
    });

    expect(result.status).toBe('needs_account');
  });

  it("refuses an account or a capture that is someone else's", async () => {
    await accounts.save(
      new Account({
        ...account('alheia', 'credit').props,
        userId: 'someone-else',
      }),
    );
    const waiting = await capture.execute({
      userId: USER_ID,
      payload: payment({ card: 'Novo' }),
      now: NOW,
    });
    const [card] = await cards.findByUserId(USER_ID);

    await expect(
      new ResolveWalletCardUseCase(deps).execute({
        userId: USER_ID,
        walletCardId: card.id,
        accountId: 'alheia',
        now: NOW,
      }),
    ).rejects.toMatchObject({ name: 'NotFoundError' });
    await expect(
      new DiscardCaptureUseCase(deps).execute({
        userId: 'someone-else',
        captureId: waiting.captureId,
        now: NOW,
      }),
    ).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('lets a waiting payment go', async () => {
    const waiting = await capture.execute({
      userId: USER_ID,
      payload: payment({ card: 'Novo' }),
      now: NOW,
    });

    await new DiscardCaptureUseCase(deps).execute({
      userId: USER_ID,
      captureId: waiting.captureId,
      now: NOW,
    });

    expect((await events.findById(waiting.captureId))?.status).toBe(
      'discarded',
    );
  });
});
