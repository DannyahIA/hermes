import { randomUUID } from 'node:crypto';

import type { AccountRepository } from '@/core/contracts/account-repository';
import type { CaptureEventRepository } from '@/core/contracts/capture-event-repository';
import type { CategoryRepository } from '@/core/contracts/category-repository';
import type { MerchantRuleRepository } from '@/core/contracts/merchant-rule-repository';
import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import type { WalletCardRepository } from '@/core/contracts/wallet-card-repository';
import {
  CaptureEvent,
  type CapturePayload,
  type CaptureStatus,
} from '@/core/entities/capture-event';
import { WalletCard } from '@/core/entities/wallet-card';
import { DomainError } from '@/core/errors/domain-error';
import { NotFoundError } from '@/core/errors/not-found-error';
import { CreateTransactionUseCase } from '@/modules/transactions/application/create-transaction.use-case';

import { normalizeMerchant } from '../domain/normalize-merchant';
import { parseAmount } from '../domain/parse-amount';
import { captureIdempotencyKey, walletCardKey } from '../domain/wallet-payload';

/** Every repository a capture touches, bound to one unit of work. */
export interface CaptureDependencies {
  captureEvents: CaptureEventRepository;
  walletCards: WalletCardRepository;
  merchantRules: MerchantRuleRepository;
  categories: CategoryRepository;
  accounts: AccountRepository;
  transactions: TransactionRepository;
}

export interface CaptureResult {
  captureId: string;
  status: CaptureStatus;
  transactionId?: string;
  /** The same payment had already been reported. */
  repeated: boolean;
}

/** What a card's name is when the shortcut sent none. */
const UNNAMED_CARD = 'Cartão sem nome';

/**
 * Turns a capture into an expense when everything it needs is known: an
 * amount, and an account for its card that can still take transactions.
 * Otherwise it says what is missing — the amount first, as the spec asks
 * for it first (2026-10-17-telegram-apple-pay-design.md §5.3).
 */
async function complete(
  deps: CaptureDependencies,
  event: CaptureEvent,
  card: WalletCard | null,
  now: Date,
): Promise<CaptureEvent> {
  const amount =
    event.payload.amount === null ? null : parseAmount(event.payload.amount);
  if (amount === null || amount <= 0) {
    return event.with({ status: 'needs_amount' }, now);
  }

  const account = card?.accountId
    ? await deps.accounts.findById(card.accountId)
    : null;
  if (
    !card ||
    !account ||
    account.userId !== event.userId ||
    account.archived
  ) {
    return event.with({ status: 'needs_account' }, now);
  }

  const { key, displayName } = normalizeMerchant(event.payload.merchant ?? '');
  const rule = key
    ? await deps.merchantRules.findByKey(event.userId, key)
    : null;
  const category = rule
    ? await deps.categories.findById(rule.categoryId)
    : null;

  const transaction = await new CreateTransactionUseCase(
    deps.transactions,
    deps.accounts,
    deps.categories,
  ).execute({
    id: randomUUID(),
    userId: event.userId,
    accountId: account.id,
    categoryId: category && !category.archived ? category.id : undefined,
    description:
      rule?.displayName || displayName || `Compra no ${card.walletName}`,
    amount,
    type: 'expense',
    occurredAt: new Date(event.payload.occurredAt),
    source: 'wallet',
  });

  return event.with({ status: 'recorded', transactionId: transaction.id }, now);
}

function resultOf(event: CaptureEvent, repeated: boolean): CaptureResult {
  return {
    captureId: event.id,
    status: event.status,
    transactionId: event.transactionId,
    repeated,
  };
}

async function ownedCapture(
  deps: CaptureDependencies,
  userId: string,
  captureId: string,
): Promise<CaptureEvent> {
  const event = await deps.captureEvents.findById(captureId);
  if (!event || event.userId !== userId) {
    throw new NotFoundError('CaptureEvent', captureId);
  }
  return event;
}

/**
 * A payment the iPhone reported from the Wallet (spec
 * 2026-10-17-telegram-apple-pay-design.md §5.3). It is recorded right away
 * as an expense on the account its card goes to, filed under the
 * merchant's category when one is remembered, or else left for "Para
 * revisar". A repeat of the same payment changes nothing; a card seen for
 * the first time, or a payment without an amount, waits for the user.
 */
export class CaptureWalletPaymentUseCase {
  constructor(private readonly deps: CaptureDependencies) {}

  async execute(input: {
    userId: string;
    payload: CapturePayload;
    now?: Date;
  }): Promise<CaptureResult> {
    const now = input.now ?? new Date();
    const key = captureIdempotencyKey(input.payload);
    const existing = await this.deps.captureEvents.findByKey(input.userId, key);
    if (existing) return resultOf(existing, true);

    const card = await this.cardFor(input.userId, input.payload.card, now);
    const event = await complete(
      this.deps,
      new CaptureEvent({
        id: randomUUID(),
        userId: input.userId,
        source: 'wallet',
        idempotencyKey: key,
        payload: input.payload,
        status: 'needs_account',
        walletCardId: card.id,
        createdAt: now,
        updatedAt: now,
      }),
      card,
      now,
    );
    await this.deps.captureEvents.save(event);
    return resultOf(event, false);
  }

  /** The card by its Wallet name, kept without an account the first time it shows up. */
  private async cardFor(
    userId: string,
    name: string | null,
    now: Date,
  ): Promise<WalletCard> {
    const walletName = name ?? UNNAMED_CARD;
    const nameKey = walletCardKey(walletName);
    const known = await this.deps.walletCards.findByKey(userId, nameKey);
    if (known) return known;

    const card = new WalletCard({
      id: randomUUID(),
      userId,
      walletName,
      nameKey,
      createdAt: now,
      updatedAt: now,
    });
    await this.deps.walletCards.save(card);
    return card;
  }
}

/**
 * Says which account a Wallet card's payments go to — and, for one card
 * that pays both ways, which other one — then records the payments that
 * were waiting for it. Returns how many were recorded.
 */
export class ResolveWalletCardUseCase {
  constructor(private readonly deps: CaptureDependencies) {}

  async execute(input: {
    userId: string;
    walletCardId: string;
    accountId: string;
    alternateAccountId?: string;
    now?: Date;
  }): Promise<number> {
    const now = input.now ?? new Date();
    const card = await this.deps.walletCards.findById(input.walletCardId);
    if (!card || card.userId !== input.userId) {
      throw new NotFoundError('WalletCard', input.walletCardId);
    }
    for (const id of [input.accountId, input.alternateAccountId]) {
      if (!id) continue;
      const account = await this.deps.accounts.findById(id);
      if (!account || account.userId !== input.userId) {
        throw new NotFoundError('Account', id);
      }
      if (account.archived) {
        throw new DomainError(
          'An archived account cannot receive new transactions.',
          'ACCOUNT_ARCHIVED',
        );
      }
    }

    const assigned = card.assign(
      input.accountId,
      input.alternateAccountId,
      now,
    );
    await this.deps.walletCards.save(assigned);

    let recorded = 0;
    for (const waiting of await this.deps.captureEvents.findWaitingForCard(
      card.id,
    )) {
      const event = await complete(this.deps, waiting, assigned, now);
      await this.deps.captureEvents.save(event);
      if (event.status === 'recorded') recorded += 1;
    }
    return recorded;
  }
}

/** Gives a payment that arrived without a value its amount, and records it. */
export class ProvideCaptureAmountUseCase {
  constructor(private readonly deps: CaptureDependencies) {}

  async execute(input: {
    userId: string;
    captureId: string;
    amount: number;
    now?: Date;
  }): Promise<CaptureResult> {
    const now = input.now ?? new Date();
    const event = await ownedCapture(this.deps, input.userId, input.captureId);
    if (event.status !== 'needs_amount') return resultOf(event, true);

    const card = event.walletCardId
      ? await this.deps.walletCards.findById(event.walletCardId)
      : null;
    const completed = await complete(
      this.deps,
      event.with({ payload: { ...event.payload, amount: input.amount } }, now),
      card,
      now,
    );
    await this.deps.captureEvents.save(completed);
    return resultOf(completed, false);
  }
}

/** Lets go of a payment still waiting for its account or amount. */
export class DiscardCaptureUseCase {
  constructor(private readonly deps: CaptureDependencies) {}

  async execute(input: {
    userId: string;
    captureId: string;
    now?: Date;
  }): Promise<void> {
    const event = await ownedCapture(this.deps, input.userId, input.captureId);
    if (!event.pending) return;
    await this.deps.captureEvents.save(
      event.with({ status: 'discarded' }, input.now ?? new Date()),
    );
  }
}
