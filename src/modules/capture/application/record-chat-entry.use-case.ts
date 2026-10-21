import { randomUUID } from 'node:crypto';

import { CaptureEvent } from '@/core/entities/capture-event';
import { SUGGESTION_HISTORY_DAYS } from '@/modules/categories/application/suggest-categories';

import { entryProblemReply } from '../domain/chat-replies';
import { buildMerchantMemory } from '../domain/merchant-memory';
import {
  parseQuickEntry,
  type QuickEntryContext,
} from '../domain/parse-quick-entry';
import { quickEntryAccounts } from '../domain/quick-entry-accounts';
import { MAX_AMOUNT } from '../schemas/record-quick-entry.schema';
import type { CaptureDependencies } from './capture-wallet-payment.use-case';
import { RecordQuickEntryUseCase } from './record-quick-entry.use-case';

/** Above this, an entry from the chat waits for a yes (spec §5.5, D3). */
export const CONFIRM_ABOVE = 500;

export type ChatEntryOutcome =
  | {
      kind: 'recorded' | 'needs_confirm';
      captureId: string;
      /** The same message had already arrived. */
      repeated: boolean;
    }
  | { kind: 'unreadable'; reply: string };

/** What the Início's quick entry knows, read for one line from the chat. */
async function quickEntryContext(
  deps: CaptureDependencies,
  userId: string,
  now: Date,
): Promise<QuickEntryContext> {
  const [accounts, categories, rules, history] = await Promise.all([
    deps.accounts.findByUserId(userId),
    deps.categories.findByUserId(userId),
    deps.merchantRules.findByUserId(userId),
    deps.transactions.findByUserId(userId, {
      from: new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - SUGGESTION_HISTORY_DAYS,
      ),
      to: now,
      pageSize: 10_000,
    }),
  ]);
  const entryAccounts = quickEntryAccounts(accounts, history);
  const selectable = categories.filter((category) => !category.archived);
  return {
    now,
    accounts: entryAccounts,
    categories: selectable.map(({ id, name }) => ({ id, name })),
    merchants: buildMerchantMemory({
      rules,
      history,
      categoryIds: selectable.map((category) => category.id),
      accountIds: entryAccounts.map((account) => account.id),
    }),
  };
}

/** Turns a held entry into its transaction, remembering the merchant's category. */
async function recordEntry(
  deps: CaptureDependencies,
  event: CaptureEvent,
  now: Date,
): Promise<CaptureEvent> {
  const { entry, occurredAt } = event.payload;
  if (!entry) return event;
  const { transaction } = await new RecordQuickEntryUseCase(
    deps.transactions,
    deps.accounts,
    deps.categories,
    deps.merchantRules,
  ).execute({
    id: randomUUID(),
    userId: event.userId,
    accountId: entry.accountId,
    categoryId: entry.categoryId,
    description: entry.description,
    amount: entry.amount,
    type: entry.type,
    occurredAt: new Date(occurredAt),
    source: 'telegram',
  });
  return event.with({ status: 'recorded', transactionId: transaction.id }, now);
}

/**
 * A line written in the chat — "almoço 32,50", "uber 18 débito", "+3000
 * salário" (spec 2026-10-17-telegram-apple-pay-design.md §5.5) — read the
 * way the Início's quick entry reads it. It is recorded right away, unless
 * it is above R$ 500 or another number could have been the amount: then it
 * waits for a yes. `key` names the chat message, so a message delivered
 * twice is recorded once.
 */
export class RecordChatEntryUseCase {
  constructor(private readonly deps: CaptureDependencies) {}

  async execute(input: {
    userId: string;
    key: string;
    text: string;
    now?: Date;
  }): Promise<ChatEntryOutcome> {
    const now = input.now ?? new Date();
    const existing = await this.deps.captureEvents.findByKey(
      input.userId,
      input.key,
    );
    if (existing) {
      return {
        kind:
          existing.status === 'needs_confirm' ? 'needs_confirm' : 'recorded',
        captureId: existing.id,
        repeated: true,
      };
    }

    const entry = parseQuickEntry(
      input.text,
      await quickEntryContext(this.deps, input.userId, now),
    );
    if (entry.amount === null) {
      return { kind: 'unreadable', reply: entryProblemReply('missing-amount') };
    }
    if (entry.amount > MAX_AMOUNT) {
      return { kind: 'unreadable', reply: 'Esse valor é alto demais.' };
    }
    if (!entry.description) {
      return {
        kind: 'unreadable',
        reply: entryProblemReply('missing-description'),
      };
    }
    if (!entry.accountId) {
      return { kind: 'unreadable', reply: entryProblemReply('no-account') };
    }

    const doubtful =
      entry.amount > CONFIRM_ABOVE ||
      entry.issues.some((issue) => issue.code === 'several-amounts');
    const held = new CaptureEvent({
      id: randomUUID(),
      userId: input.userId,
      source: 'telegram_text',
      idempotencyKey: input.key,
      payload: {
        amount: entry.amount,
        merchant: entry.description,
        card: null,
        occurredAt: entry.occurredAt.toISOString(),
        entry: {
          description: entry.description,
          amount: entry.amount,
          type: entry.type,
          accountId: entry.accountId,
          categoryId: entry.categoryId ?? undefined,
        },
      },
      status: 'needs_confirm',
      createdAt: now,
      updatedAt: now,
    });
    const event = doubtful ? held : await recordEntry(this.deps, held, now);
    await this.deps.captureEvents.save(event);
    return {
      kind: doubtful ? 'needs_confirm' : 'recorded',
      captureId: event.id,
      repeated: false,
    };
  }
}

/** "Salvar" under an entry that waited for a yes. */
export class ConfirmChatEntryUseCase {
  constructor(private readonly deps: CaptureDependencies) {}

  async execute(input: {
    userId: string;
    captureId: string;
    now?: Date;
  }): Promise<CaptureEvent | null> {
    const event = await this.deps.captureEvents.findById(input.captureId);
    if (!event || event.userId !== input.userId) return null;
    if (event.status !== 'needs_confirm') return event;
    const recorded = await recordEntry(
      this.deps,
      event,
      input.now ?? new Date(),
    );
    await this.deps.captureEvents.save(recorded);
    return recorded;
  }
}
