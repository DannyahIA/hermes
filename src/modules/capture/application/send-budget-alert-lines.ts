import type { ChatChannel } from '@/core/contracts/chat-channel';

/**
 * Sends budget alert lines to a chat as one message of their own. A chat that
 * can't be reached never fails the purchase the lines are about: the error is
 * logged and swallowed. `reference` names what the lines are about — ids,
 * never what was spent.
 */
export async function sendBudgetAlertLines(
  channel: ChatChannel,
  chatId: string,
  lines: string[],
  reference: string,
): Promise<void> {
  if (lines.length === 0) return;
  try {
    await channel.send(chatId, { text: lines.join('\n') });
  } catch (error) {
    console.error(
      `chat budget alert for ${reference} failed:`,
      error instanceof Error ? error.message : 'unknown error',
    );
  }
}
