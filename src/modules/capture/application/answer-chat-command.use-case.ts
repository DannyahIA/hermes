import type { ChatMessage } from '@/core/contracts/chat-channel';
import {
  GetCardStatementsUseCase,
  GetSpendingSnapshotUseCase,
} from '@/modules/dashboard/application/get-spending-snapshot.use-case';

import type { ChatCommand } from '../domain/chat-command';
import {
  billsReply,
  freeReply,
  HELP_REPLY,
  PRIVATE_REPLY,
  todayReply,
  undoQuestion,
} from '../domain/chat-replies';
import { momentLabel } from '../domain/moment-label';
import type { ChatDependencies } from './chat-dependencies';
import { GetChatPrivacyUseCase } from './chat-privacy.use-case';

/** /desfazer reaches as far back as the buttons work. */
const UNDO_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The bot's commands (spec 2026-10-17-telegram-apple-pay-design.md §5.6).
 * They only read, except /desfazer, which asks before anything is undone.
 * What is free and the cards' statements stay out of the chat when the
 * user asked so (§8, D5).
 */
export class AnswerChatCommandUseCase {
  constructor(private readonly deps: ChatDependencies) {}

  async execute(input: {
    userId: string;
    command: ChatCommand;
    now?: Date;
  }): Promise<ChatMessage> {
    const now = input.now ?? new Date();
    const { userId } = input;

    switch (input.command) {
      case 'ajuda':
        return { text: HELP_REPLY };

      case 'livre':
      case 'fatura': {
        const { showFree } = await new GetChatPrivacyUseCase(
          this.deps.viewPreferences,
        ).execute(userId);
        if (!showFree) return { text: PRIVATE_REPLY };
        if (input.command === 'livre') {
          const { available } = await new GetSpendingSnapshotUseCase(
            this.deps.accounts,
            this.deps.transactions,
            this.deps.budgets,
            this.deps.recurringTransactions,
          ).execute(userId, now);
          return { text: freeReply(available) };
        }
        return {
          text: billsReply(
            await new GetCardStatementsUseCase(
              this.deps.accounts,
              this.deps.transactions,
            ).execute(userId, now),
          ),
        };
      }

      case 'hoje': {
        const today = await this.deps.transactions.findByUserId(userId, {
          from: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          to: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
          pageSize: 10_000,
        });
        return {
          text: todayReply(
            today
              .filter((transaction) => transaction.countsAs('expense'))
              .map((transaction) => ({
                description: transaction.description,
                amount: transaction.amount,
                at: transaction.occurredAt,
              })),
          ),
        };
      }

      case 'desfazer':
        return this.lastToUndo(userId, now);
    }
  }

  private async lastToUndo(userId: string, now: Date): Promise<ChatMessage> {
    const recent = await this.deps.captureEvents.findByUserId(userId, {
      statuses: ['recorded'],
      limit: 20,
    });
    for (const event of recent) {
      if (now.getTime() - event.createdAt.getTime() > UNDO_WINDOW_MS) break;
      const transaction = event.transactionId
        ? await this.deps.transactions.findById(event.transactionId)
        : null;
      if (!transaction) continue;
      const plan = transaction.installmentPlanId
        ? await this.deps.installmentPlans.findById(
            transaction.installmentPlanId,
          )
        : null;
      return undoQuestion({
        captureId: event.id,
        description: plan?.description ?? transaction.description,
        amount: plan?.totalAmount ?? transaction.amount,
        when: momentLabel(new Date(event.payload.occurredAt), now),
      });
    }
    return { text: 'Nada para desfazer dos últimos 7 dias.' };
  }
}
