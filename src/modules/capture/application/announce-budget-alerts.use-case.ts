import type { ChatChannel } from '@/core/contracts/chat-channel';
import { CheckBudgetAlertsUseCase } from '@/modules/budgets/application/check-budget-alerts.use-case';

import type { ChatUnitOfWork } from './chat-dependencies';

/**
 * Tells the user's chat where a purchase took a budget: a message of its own,
 * sent right after the purchase's. The check — which also marks each stage as
 * told — runs inside the unit of work; the chat is spoken to once that is
 * kept. Without a connected chat nothing is said, and the lines are still
 * returned. Neither a chat that can't be reached nor a check that fails ever
 * fails the purchase: logs carry ids, never what was spent.
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

    let checked: { lines: string[]; chatId?: string };
    try {
      checked = await this.run(async (deps) => {
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
    } catch (error) {
      // The purchase is kept and its message told; a warning that couldn't
      // be worked out is missed, not a reason to fail what came before it.
      console.error(
        `budget alert check of ${input.transactionIds.join(', ')} failed:`,
        error instanceof Error ? error.message : 'unknown error',
      );
      return [];
    }
    const { lines, chatId } = checked;

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
