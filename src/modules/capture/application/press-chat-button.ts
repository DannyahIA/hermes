import { randomUUID } from 'node:crypto';

import type { ChatMessage } from '@/core/contracts/chat-channel';
import type { CaptureEvent } from '@/core/entities/capture-event';
import { CreateInstallmentPlanUseCase } from '@/modules/installments/application/create-installment-plan.use-case';
import { DeleteInstallmentPlanUseCase } from '@/modules/installments/application/delete-installment-plan.use-case';
import { CategorizeTransactionUseCase } from '@/modules/transactions/application/categorize-transaction.use-case';
import { DeleteTransactionUseCase } from '@/modules/transactions/application/delete-transaction.use-case';
import { MoveTransactionToAccountUseCase } from '@/modules/transactions/application/move-transaction-to-account.use-case';

import {
  captureMessage,
  categoryPickerMessage,
  installmentsPickerMessage,
} from '../domain/capture-message';
import type { ChatAction } from '../domain/chat-action';
import {
  DiscardCaptureUseCase,
  ResolveWalletCardUseCase,
} from './capture-wallet-payment.use-case';
import type { ChatDependencies } from './chat-dependencies';
import {
  describeCapture,
  recordedView,
  storyMessage,
  switchTarget,
} from './describe-capture';
import { ConfirmChatEntryUseCase } from './record-chat-entry.use-case';

const CHANGED = 'Esta compra mudou. Veja como ela está agora.';
const KEPT = 'Ok, ficou como estava.';

/** What a tapped button comes to, once its work is kept. */
export interface ButtonOutcome {
  /** The message under which it was tapped, as it should read now. */
  message?: ChatMessage;
  /**
   * The payment's own message reads the same (it was tapped elsewhere:
   * under the /desfazer question).
   */
  mirror?: boolean;
  notice?: string;
  /** Captures whose messages are to be brought up to date instead. */
  announce?: { userId: string; captureIds: string[] };
}

/**
 * Does what a button under a capture's message says (spec 2026-10-17-
 * telegram-apple-pay-design.md §5.4, §5.5), inside the unit of work: files,
 * moves, splits, undoes, confirms or lets go. A button that no longer fits
 * the capture shows how it stands now instead.
 */
export async function pressChatButton(
  deps: ChatDependencies,
  action: ChatAction,
  event: CaptureEvent,
  now: Date,
): Promise<ButtonOutcome> {
  const current = async (notice?: string): Promise<ButtonOutcome> => ({
    message: storyMessage(await describeCapture(deps, event, now)),
    notice,
  });
  const { userId } = event;

  if (action.kind === 'show') return current();

  if (action.kind === 'keep') return { message: { text: KEPT } };

  if (action.kind === 'confirm') {
    if (event.status !== 'needs_confirm') return current(CHANGED);
    const recorded = await new ConfirmChatEntryUseCase(deps).execute({
      userId,
      captureId: event.id,
      now,
    });
    return {
      message: storyMessage(
        await describeCapture(deps, recorded ?? event, now),
      ),
    };
  }

  if (action.kind === 'card-account') {
    if (event.status !== 'needs_account' || !event.walletCardId) {
      return current(CHANGED);
    }
    const recorded = await new ResolveWalletCardUseCase(deps).execute({
      userId,
      walletCardId: event.walletCardId,
      accountId: action.accountId,
      now,
    });
    return {
      announce: {
        userId,
        captureIds: [...new Set([event.id, ...recorded])],
      },
    };
  }

  if (action.kind === 'discard') {
    if (!event.pending) return current(CHANGED);
    await new DiscardCaptureUseCase(deps).execute({
      userId,
      captureId: event.id,
      now,
    });
    const discarded = await deps.captureEvents.findById(event.id);
    return {
      message: storyMessage(await describeCapture(deps, discarded!, now)),
    };
  }

  // Every other button acts on the recorded purchase.
  const transaction =
    event.status === 'recorded' && event.transactionId
      ? await deps.transactions.findById(event.transactionId)
      : null;
  if (!transaction) return current(CHANGED);
  const plan = transaction.installmentPlanId
    ? await deps.installmentPlans.findById(transaction.installmentPlanId)
    : null;

  switch (action.kind) {
    case 'category': {
      if (plan) return current(CHANGED);
      const { rule } = await new CategorizeTransactionUseCase(
        deps.transactions,
        deps.accounts,
        deps.categories,
        deps.merchantRules,
      ).execute({
        userId,
        transactionId: transaction.id,
        categoryId: action.categoryId,
      });
      return {
        message: storyMessage(
          await describeCapture(deps, event, now, rule !== null),
        ),
      };
    }

    case 'pick-category': {
      const view = await recordedView(deps, event, now);
      if (!view || plan) return current(CHANGED);
      const categories = (await deps.categories.findByUserId(userId))
        .filter((category) => !category.archived)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
        .map((category) => ({ id: category.id, name: category.name }));
      return {
        message: categoryPickerMessage(view, categories, action.page),
      };
    }

    case 'ask-installments': {
      const view = await recordedView(deps, event, now);
      if (!view?.installable || plan) return current(CHANGED);
      return { message: installmentsPickerMessage(view) };
    }

    case 'switch-account': {
      const card = event.walletCardId
        ? await deps.walletCards.findById(event.walletCardId)
        : null;
      const target = switchTarget(card, transaction);
      if (!target || plan) return current(CHANGED);
      await new MoveTransactionToAccountUseCase(
        deps.transactions,
        deps.accounts,
      ).execute({ userId, transactionId: transaction.id, accountId: target });
      return current();
    }

    case 'installments': {
      const account = await deps.accounts.findById(transaction.accountId);
      // Only a credit card purchase is paid in installments.
      if (plan || account?.type !== 'credit') return current(CHANGED);
      await new DeleteTransactionUseCase(
        deps.transactions,
        deps.accounts,
      ).execute({ id: transaction.id, userId });
      const installmentIds = Array.from({ length: action.count }, () =>
        randomUUID(),
      );
      await new CreateInstallmentPlanUseCase(
        deps.installmentPlans,
        deps.transactions,
        deps.accounts,
        deps.categories,
      ).execute({
        id: randomUUID(),
        userId,
        accountId: transaction.accountId,
        categoryId: transaction.categoryId,
        description: transaction.description,
        kind: 'purchase',
        totalAmount: transaction.amount,
        installmentCount: action.count,
        startDate: transaction.occurredAt,
        installmentIds,
      });
      const split = event.with({ transactionId: installmentIds[0] }, now);
      await deps.captureEvents.save(split);
      return {
        message: storyMessage(await describeCapture(deps, split, now)),
      };
    }

    case 'undo': {
      if (plan) {
        await new DeleteInstallmentPlanUseCase(
          deps.installmentPlans,
          deps.transactions,
          deps.accounts,
        ).execute({ id: plan.id, userId });
      } else {
        await new DeleteTransactionUseCase(
          deps.transactions,
          deps.accounts,
        ).execute({ id: transaction.id, userId });
      }
      await deps.captureEvents.save(
        event.with({ transactionId: undefined }, now),
      );
      return {
        mirror: true,
        message: captureMessage({
          kind: 'undone',
          description: plan?.description ?? transaction.description,
          amount: plan?.totalAmount ?? transaction.amount,
          plan: plan !== null,
        }),
      };
    }
  }
}
