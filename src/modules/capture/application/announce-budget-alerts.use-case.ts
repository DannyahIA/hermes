import type { ChatChannel } from '@/core/contracts/chat-channel';
import { CheckBudgetAlertsUseCase } from '@/modules/budgets/application/check-budget-alerts.use-case';

import type { ChatUnitOfWork } from './chat-dependencies';

/**
 * Tells the user's chat where a purchase took a budget: a message of its own,
 * sent right after the purchase's. The check — which also marks each stage as
 * told — runs inside the unit of work; the chat is spoken to once that is
 * kept. Without a connected chat nothing is said, and the lines are still
 * returned. A chat that can't be reached never fails the purchase: logs carry
 * ids, never what was spent.
 */
export class AnnounceBudgetAlertsUseCase {
  constructor(
    private readonly channel: ChatChannel,
    private readonly run: ChatUnitOfWork,
  ) {}

  async execute(input: {
    userId: string;
    transactionIds: string[];
    now?: Date;
  }): Promise<string[]> {
    if (input.transactionIds.length === 0) return [];
    const now = input.now ?? new Date();

    const { lines, chatId } = await this.run(async (deps) => {
      const link = await deps.chatLinks.findActiveByUserId(input.userId);
      const lines = await new CheckBudgetAlertsUseCase(
        deps.transactions,
        deps.budgets,
        deps.categories,
        deps.budgetAlerts,
      ).execute({
        userId: input.userId,
        transactionIds: input.transactionIds,
        now,
      });
      return { lines, chatId: link?.externalChatId };
    });

    if (lines.length > 0 && chatId) {
      try {
        await this.channel.send(chatId, { text: lines.join('\n') });
      } catch (error) {
        console.error(
          `chat budget alert for ${input.transactionIds.join(', ')} failed:`,
          error instanceof Error ? error.message : 'unknown error',
        );
      }
    }
    return lines;
  }
}
