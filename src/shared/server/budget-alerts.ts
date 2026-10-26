import { after } from 'next/server';

import { DrizzleBudgetRepository } from '@/infra/repositories/drizzle-budget.repository';
import { DrizzleBudgetAlertLogRepository } from '@/infra/repositories/drizzle-budget-alert-log.repository';
import { DrizzleCategoryRepository } from '@/infra/repositories/drizzle-category.repository';
import { DrizzleChatLinkRepository } from '@/infra/repositories/drizzle-chat-link.repository';
import { DrizzleTransactionRepository } from '@/infra/repositories/drizzle-transaction.repository';
import { CheckBudgetAlertsUseCase } from '@/modules/budgets/application/check-budget-alerts.use-case';
import { sendBudgetAlertLines } from '@/modules/capture/application/send-budget-alert-lines';

import { telegramChannel } from './chat';

/**
 * What these purchases tell about the user's budgets, for an action to return
 * once its own transaction has been committed. Each stage is told once per
 * period, so asking again says nothing new. An alert never fails a purchase:
 * on any error it logs the ids, never what was spent, and returns nothing.
 */
export async function checkBudgetAlerts(
  userId: string,
  transactionIds: string[],
): Promise<string[]> {
  if (transactionIds.length === 0) return [];
  try {
    return await new CheckBudgetAlertsUseCase(
      new DrizzleTransactionRepository(),
      new DrizzleBudgetRepository(),
      new DrizzleCategoryRepository(),
      new DrizzleBudgetAlertLogRepository(),
    ).execute({ userId, transactionIds, now: new Date() });
  } catch (error) {
    console.error(
      `budget alert check of ${transactionIds.join(', ')} failed:`,
      error instanceof Error ? error.message : 'unknown error',
    );
    return [];
  }
}

/**
 * Sends lines `checkBudgetAlerts` already worked out to the user's active
 * chat, if there is one and the bot is set up. Never checks again: that would
 * claim the stages a second time.
 */
export async function sendBudgetAlertsToChat(
  userId: string,
  lines: string[],
): Promise<void> {
  if (lines.length === 0) return;
  const channel = telegramChannel();
  if (!channel) return;
  try {
    const link = await new DrizzleChatLinkRepository().findActiveByUserId(
      userId,
    );
    if (!link) return;
    await sendBudgetAlertLines(
      channel,
      link.externalChatId,
      lines,
      `user ${userId}`,
    );
  } catch (error) {
    console.error(
      `chat budget alert for user ${userId} failed:`,
      error instanceof Error ? error.message : 'unknown error',
    );
  }
}

/**
 * What an action does once its own transaction has been committed: checks the
 * purchases, hands the lines back for the caller's toast, and sends them to
 * the user's chat after the response.
 */
export async function budgetAlertsFor(
  userId: string,
  transactionIds: string[],
): Promise<string[]> {
  const alerts = await checkBudgetAlerts(userId, transactionIds);
  if (alerts.length > 0) {
    // The purchase is committed: failing to schedule the chat message must
    // not turn it into a reported failure.
    try {
      after(() => sendBudgetAlertsToChat(userId, alerts));
    } catch (error) {
      console.error(
        `scheduling the chat budget alert for user ${userId} failed:`,
        error instanceof Error ? error.message : 'unknown error',
      );
    }
  }
  return alerts;
}
