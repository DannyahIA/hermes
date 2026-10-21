import { getTelegramBot } from '@/config/env';
import { pollTelegram } from '@/infra/telegram/polling-worker';
import { TelegramBotApi } from '@/infra/telegram/telegram-bot-api.client';
import { CHAT_COMMANDS } from '@/modules/capture/domain/chat-command';
import { telegramUpdateHandler } from '@/shared/server/chat';

/**
 * `pnpm telegram:poll`: the Telegram bot, run next to `next start` (spec
 * 2026-10-17-telegram-apple-pay-design.md §9). It needs only outbound
 * internet; stop it with Ctrl+C (or SIGTERM from systemd/Docker).
 */
async function main() {
  const bot = getTelegramBot();
  const onUpdate = telegramUpdateHandler();
  if (!bot || !onUpdate) {
    console.error(
      'Set TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_USERNAME in .env.local to run the bot.',
    );
    process.exitCode = 1;
    return;
  }

  const controller = new AbortController();
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => controller.abort());
  }
  const api = new TelegramBotApi(bot.token);
  // The menu Telegram shows when "/" is typed. Without it the commands
  // still work, so a failure here only gets a line in the log.
  try {
    await api.call('setMyCommands', {
      commands: CHAT_COMMANDS.map(({ name, description }) => ({
        command: name,
        description,
      })),
    });
  } catch (error) {
    console.error(
      'Could not set the bot’s command menu:',
      error instanceof Error ? error.message : 'unknown error',
    );
  }

  console.info(`Listening to @${bot.username} on Telegram.`);
  await pollTelegram({
    api,
    onUpdate,
    signal: controller.signal,
  });
}

main()
  .catch((error) => {
    console.error(
      'Telegram bot stopped:',
      error instanceof Error ? error.message : 'unknown error',
    );
    process.exitCode = 1;
  })
  // The database pool would keep the process alive.
  .finally(() => process.exit());
