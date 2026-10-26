import { getTelegramBot } from '@/config/env';
import type { ChatChannel } from '@/core/contracts/chat-channel';
import type { Executor } from '@/infra/database/client';
import { withTransaction } from '@/infra/database/transaction';
import { DrizzleBudgetRepository } from '@/infra/repositories/drizzle-budget.repository';
import { DrizzleBudgetAlertLogRepository } from '@/infra/repositories/drizzle-budget-alert-log.repository';
import { DrizzleChatLinkRepository } from '@/infra/repositories/drizzle-chat-link.repository';
import { DrizzleInstallmentPlanRepository } from '@/infra/repositories/drizzle-installment-plan.repository';
import { DrizzleRecurringTransactionRepository } from '@/infra/repositories/drizzle-recurring-transaction.repository';
import { DrizzleViewPreferenceRepository } from '@/infra/repositories/drizzle-view-preference.repository';
import { TelegramBotApi } from '@/infra/telegram/telegram-bot-api.client';
import { TelegramChatChannel } from '@/infra/telegram/telegram-chat-channel';
import { toChatUpdate } from '@/infra/telegram/telegram-update.mapper';
import { AnnounceCapturesUseCase } from '@/modules/capture/application/announce-captures.use-case';
import type {
  ChatDependencies,
  ChatUnitOfWork,
} from '@/modules/capture/application/chat-dependencies';
import { HandleChatUpdateUseCase } from '@/modules/capture/application/handle-chat-update.use-case';

import { captureDependencies } from './capture-dependencies';

/** The chat's repositories, all on one unit of work. */
export function chatDependencies(executor: Executor): ChatDependencies {
  return {
    ...captureDependencies(executor),
    chatLinks: new DrizzleChatLinkRepository(executor),
    installmentPlans: new DrizzleInstallmentPlanRepository(executor),
    budgets: new DrizzleBudgetRepository(executor),
    budgetAlerts: new DrizzleBudgetAlertLogRepository(executor),
    recurringTransactions: new DrizzleRecurringTransactionRepository(executor),
    viewPreferences: new DrizzleViewPreferenceRepository(executor),
  };
}

export const chatUnitOfWork: ChatUnitOfWork = (work) =>
  withTransaction((tx) => work(chatDependencies(tx)));

/** The Telegram bot, or null when it isn't set up. */
export function telegramChannel(): ChatChannel | null {
  const bot = getTelegramBot();
  return bot ? new TelegramChatChannel(new TelegramBotApi(bot.token)) : null;
}

/**
 * Tells the user's chat about these captures. A chat that can't be
 * reached never fails what it tells about: the captures are kept, and
 * wait in Configurações. Logs carry ids, never what was paid.
 */
export async function announceCaptures(
  userId: string,
  captureIds: string[],
): Promise<void> {
  const channel = telegramChannel();
  if (!channel || captureIds.length === 0) return;
  try {
    await new AnnounceCapturesUseCase(channel, chatUnitOfWork).execute({
      userId,
      captureIds,
    });
  } catch (error) {
    console.error(
      `chat announcement of ${captureIds.join(', ')} failed:`,
      error instanceof Error ? error.message : 'unknown error',
    );
  }
}

/**
 * What handles each Telegram update — from the polling worker or the
 * webhook alike — or null when the bot isn't set up.
 */
export function telegramUpdateHandler():
  ((raw: unknown) => Promise<void>) | null {
  const channel = telegramChannel();
  if (!channel) return null;
  const handler = new HandleChatUpdateUseCase(channel, chatUnitOfWork);
  return async (raw) => {
    const update = toChatUpdate(raw);
    if (update) await handler.execute(update);
  };
}
