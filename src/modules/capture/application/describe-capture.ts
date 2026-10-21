import type { ChatMessage } from '@/core/contracts/chat-channel';
import type { AccountKind } from '@/core/entities/account';
import type { CaptureEvent } from '@/core/entities/capture-event';
import type { Transaction } from '@/core/entities/transaction';
import type { WalletCard } from '@/core/entities/wallet-card';
import { GetCategorySuggestionsUseCase } from '@/modules/categories/application/get-category-suggestions.use-case';
import { GetSpendingSnapshotUseCase } from '@/modules/dashboard/application/get-spending-snapshot.use-case';

import {
  amountQuestion,
  captureMessage,
  type CaptureView,
  type Named,
  type RecordedView,
} from '../domain/capture-message';
import { dayLabel, momentLabel } from '../domain/moment-label';
import { normalizeMerchant } from '../domain/normalize-merchant';
import { parseAmount } from '../domain/parse-amount';
import { budgetAlert, freeLine } from '../domain/spending-lines';
import type { ChatDependencies } from './chat-dependencies';
import { GetChatPrivacyUseCase } from './chat-privacy.use-case';

/** Where a capture stands, as the chat tells it. */
export type CaptureStory =
  CaptureView | { kind: 'needs_amount'; description: string; cardName: string };

/** A Wallet card pays from a credit card or a checking account, credit first. */
const CARD_ACCOUNT_KINDS: AccountKind[] = ['credit', 'checking'];
/** Five rows of two: what fits a chat message comfortably. */
const MAX_ACCOUNT_BUTTONS = 10;

const named = (item: { id: string; name: string }): Named => ({
  id: item.id,
  name: item.name,
});

function cardFor(
  deps: ChatDependencies,
  event: CaptureEvent,
): Promise<WalletCard | null> {
  return event.walletCardId
    ? deps.walletCards.findById(event.walletCardId)
    : Promise.resolve(null);
}

function cardName(event: CaptureEvent, card: WalletCard | null): string {
  return card?.walletName ?? event.payload.card ?? 'Cartão sem nome';
}

/** The merchant's clean name, or "Compra no Nubank" without one. */
function merchantName(event: CaptureEvent, card: WalletCard | null): string {
  const { displayName } = normalizeMerchant(event.payload.merchant ?? '');
  return displayName || `Compra no ${cardName(event, card)}`;
}

/**
 * The other account of a Wallet card that pays both ways — the one
 * "Foi no débito" (or "no crédito") moves the purchase to.
 */
export function switchTarget(
  card: WalletCard | null,
  transaction: Transaction,
): string | undefined {
  if (!card?.accountId || !card.alternateAccountId) return undefined;
  return transaction.accountId === card.alternateAccountId
    ? card.accountId
    : card.alternateAccountId;
}

/**
 * A recorded payment as its message shows it, or null once its
 * transaction is gone. `learned` says the merchant was just taught its
 * category.
 */
export async function recordedView(
  deps: ChatDependencies,
  event: CaptureEvent,
  now: Date,
  learned = false,
): Promise<RecordedView | null> {
  const transaction = event.transactionId
    ? await deps.transactions.findById(event.transactionId)
    : null;
  if (!transaction) return null;

  const [plan, account, category, card] = await Promise.all([
    transaction.installmentPlanId
      ? deps.installmentPlans.findById(transaction.installmentPlanId)
      : null,
    deps.accounts.findById(transaction.accountId),
    transaction.categoryId
      ? deps.categories.findById(transaction.categoryId)
      : null,
    cardFor(deps, event),
  ]);

  let suggestions: Named[] = [];
  if (!category && !plan) {
    const ids =
      (
        await new GetCategorySuggestionsUseCase(
          deps.transactions,
          deps.categories,
          deps.merchantRules,
        ).execute({ userId: event.userId, transactions: [transaction], now })
      ).categories[transaction.id] ?? [];
    const found = await Promise.all(
      ids.map((id) => deps.categories.findById(id)),
    );
    suggestions = found.filter((item) => item !== null).map(named);
  }

  const target = plan ? undefined : switchTarget(card, transaction);
  const targetAccount = target ? await deps.accounts.findById(target) : null;

  const { showFree } = await new GetChatPrivacyUseCase(
    deps.viewPreferences,
  ).execute(event.userId);
  const snapshot = await new GetSpendingSnapshotUseCase(
    deps.accounts,
    deps.transactions,
    deps.budgets,
    deps.recurringTransactions,
  ).execute(event.userId, now);
  const alert = budgetAlert(snapshot.budgets, category?.id, category?.name);

  return {
    kind: 'recorded',
    captureId: event.id,
    when: momentLabel(new Date(event.payload.occurredAt), now),
    description: plan?.description ?? transaction.description,
    amount: plan?.totalAmount ?? transaction.amount,
    accountName: account?.name ?? 'Conta removida',
    category: category ? named(category) : undefined,
    learned,
    installable: account?.type === 'credit' && transaction.type === 'expense',
    installments: plan
      ? {
          count: plan.installmentCount,
          each: transaction.amount,
          first: dayLabel(transaction.occurredAt, now),
        }
      : undefined,
    switchLabel: targetAccount
      ? targetAccount.type === 'credit'
        ? 'Foi no crédito'
        : 'Foi no débito'
      : undefined,
    suggestions,
    free: showFree ? freeLine(snapshot.available) : undefined,
    alerts: alert ? [alert] : [],
  };
}

/** Where a capture stands now, whatever its state. */
export async function describeCapture(
  deps: ChatDependencies,
  event: CaptureEvent,
  now: Date,
  learned = false,
): Promise<CaptureStory> {
  const card = await cardFor(deps, event);
  const description = merchantName(event, card);

  switch (event.status) {
    case 'recorded':
      return (
        (await recordedView(deps, event, now, learned)) ?? {
          kind: 'gone',
          description,
        }
      );
    case 'needs_amount':
      return {
        kind: 'needs_amount',
        description,
        cardName: cardName(event, card),
      };
    case 'needs_account': {
      const amount =
        event.payload.amount === null
          ? null
          : parseAmount(event.payload.amount);
      const accounts = (await deps.accounts.findByUserId(event.userId))
        .filter(
          (account) =>
            !account.archived && CARD_ACCOUNT_KINDS.includes(account.type),
        )
        .sort(
          (a, b) =>
            CARD_ACCOUNT_KINDS.indexOf(a.type) -
              CARD_ACCOUNT_KINDS.indexOf(b.type) ||
            a.name.localeCompare(b.name, 'pt-BR'),
        );
      return {
        kind: 'needs_account',
        captureId: event.id,
        when: momentLabel(new Date(event.payload.occurredAt), now),
        description,
        amount: amount && amount > 0 ? amount : null,
        cardName: cardName(event, card),
        accounts: accounts.slice(0, MAX_ACCOUNT_BUTTONS).map(named),
        moreAccounts: accounts.length > MAX_ACCOUNT_BUTTONS,
      };
    }
    case 'needs_confirm': {
      const { entry } = event.payload;
      const account = entry
        ? await deps.accounts.findById(entry.accountId)
        : null;
      return {
        kind: 'needs_confirm',
        captureId: event.id,
        description: entry?.description ?? description,
        amount: entry?.amount ?? 0,
        type: entry?.type ?? 'expense',
        accountName: account?.name ?? 'Conta removida',
        day: dayLabel(new Date(event.payload.occurredAt), now),
      };
    }
    case 'discarded':
      return event.source === 'telegram_text'
        ? { kind: 'not-saved', description }
        : { kind: 'discarded', description };
  }
}

/** The message a story is told with. */
export function storyMessage(story: CaptureStory): ChatMessage {
  return story.kind === 'needs_amount'
    ? amountQuestion(story.description, story.cardName)
    : captureMessage(story);
}
