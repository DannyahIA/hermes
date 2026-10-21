import {
  TelegramApiError,
  type TelegramBotApi,
} from './telegram-bot-api.client';

const RETRY_MS = 5_000;

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

export interface PollingOptions {
  api: TelegramBotApi;
  /** Handles one update; a failure is logged and the next one goes on. */
  onUpdate: (update: unknown) => Promise<void>;
  /** Stops the worker. */
  signal: AbortSignal;
  /** How long Telegram holds each call open waiting for news. */
  timeoutSeconds?: number;
  pause?: (ms: number, signal: AbortSignal) => Promise<void>;
}

/**
 * Long polling (spec 2026-10-17-telegram-apple-pay-design.md §9, D2):
 * Hermes asks Telegram for news instead of being called, so the bot works
 * with outbound internet alone — no public address. The webhook is turned
 * off first, as Telegram serves one way or the other. Each update is
 * acknowledged (by asking past it) whether or not it was handled, so a
 * bad one can't block the rest.
 */
export async function pollTelegram({
  api,
  onUpdate,
  signal,
  timeoutSeconds = 50,
  pause = sleep,
}: PollingOptions): Promise<void> {
  await api.call('deleteWebhook', {}, { signal });

  let offset: number | undefined;
  while (!signal.aborted) {
    let updates: Array<{ update_id: number }>;
    try {
      updates = await api.call(
        'getUpdates',
        {
          offset,
          timeout: timeoutSeconds,
          allowed_updates: ['message', 'callback_query'],
        },
        { signal },
      );
    } catch (error) {
      if (signal.aborted) break;
      console.error(`telegram polling failed: ${message(error)}`);
      const retryAfter =
        error instanceof TelegramApiError ? error.retryAfter : undefined;
      await pause(retryAfter ? retryAfter * 1000 : RETRY_MS, signal);
      continue;
    }

    for (const update of updates) {
      offset = update.update_id + 1;
      try {
        await onUpdate(update);
      } catch (error) {
        console.error(
          `telegram update ${update.update_id} failed: ${message(error)}`,
        );
      }
    }
  }
}
