import { afterEach, describe, expect, it, vi } from 'vitest';

import { pollTelegram } from './polling-worker';
import { TelegramBotApi } from './telegram-bot-api.client';

/**
 * A Bot API that answers getUpdates with `batches`, one per call, and
 * stops the worker once they run out.
 */
function scriptedTelegram(batches: unknown[], controller: AbortController) {
  const calls: Array<{ method: string; body: Record<string, unknown> }> = [];
  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    const method = String(url).split('/').at(-1)!;
    calls.push({ method, body: JSON.parse(String(init?.body)) });
    if (method !== 'getUpdates') {
      return new Response(JSON.stringify({ ok: true, result: true }));
    }
    const next = batches.shift();
    if (next === undefined) {
      controller.abort();
      throw new DOMException('aborted', 'AbortError');
    }
    return new Response(JSON.stringify(next));
  }) as typeof fetch;
  return { calls, api: new TelegramBotApi('token', fetcher) };
}

describe('polling Telegram for updates', () => {
  afterEach(() => vi.restoreAllMocks());

  it('turns the webhook off, then hands over each update once', async () => {
    const controller = new AbortController();
    const { calls, api } = scriptedTelegram(
      [
        { ok: true, result: [{ update_id: 7 }, { update_id: 8 }] },
        { ok: true, result: [{ update_id: 9 }] },
      ],
      controller,
    );
    const seen: unknown[] = [];

    await pollTelegram({
      api,
      signal: controller.signal,
      onUpdate: async (update) => {
        seen.push(update);
      },
    });

    expect(calls[0].method).toBe('deleteWebhook');
    expect(seen).toEqual([
      { update_id: 7 },
      { update_id: 8 },
      { update_id: 9 },
    ]);
    const offsets = calls
      .filter((call) => call.method === 'getUpdates')
      .map((call) => call.body.offset);
    expect(offsets).toEqual([undefined, 9, 10]);
  });

  it('keeps going past an update that fails, and past Telegram failing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const controller = new AbortController();
    const { api } = scriptedTelegram(
      [
        { ok: false, error_code: 502, description: 'Bad Gateway' },
        { ok: true, result: [{ update_id: 1 }, { update_id: 2 }] },
      ],
      controller,
    );
    const seen: number[] = [];

    await pollTelegram({
      api,
      signal: controller.signal,
      pause: async () => {},
      onUpdate: async (update) => {
        const { update_id: updateId } = update as { update_id: number };
        if (updateId === 1) throw new Error('boom');
        seen.push(updateId);
      },
    });

    expect(seen).toEqual([2]);
    expect(console.error).toHaveBeenCalledTimes(2);
  });
});
