import net from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';

import { TelegramBotApi } from './telegram-bot-api.client';
import { TelegramChatChannel } from './telegram-chat-channel';

const TOKEN = '123456:secret-token';

/** Answers every Bot API call with `reply`, keeping what was asked. */
function fakeTelegram(reply: (method: string) => unknown) {
  const calls: Array<{ method: string; body: Record<string, unknown> }> = [];
  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    const method = String(url).split('/').at(-1)!;
    calls.push({ method, body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify(reply(method)));
  }) as typeof fetch;
  return {
    calls,
    channel: new TelegramChatChannel(new TelegramBotApi(TOKEN, fetcher)),
  };
}

const ok = (result: unknown = true) => ({ ok: true, result });

describe('the Telegram chat channel', () => {
  it('sends a message with its buttons under it', async () => {
    const { calls, channel } = fakeTelegram(() => ok({ message_id: 42 }));

    const sent = await channel.send('5551234', {
      text: 'Nubank Crédito · R$ 23,90',
      buttons: [[{ text: 'Desfazer', data: 'u:abc' }]],
    });

    expect(sent).toEqual({ messageId: '42' });
    expect(calls).toEqual([
      {
        method: 'sendMessage',
        body: {
          chat_id: '5551234',
          text: 'Nubank Crédito · R$ 23,90',
          reply_markup: {
            inline_keyboard: [[{ text: 'Desfazer', callback_data: 'u:abc' }]],
          },
        },
      },
    ]);
  });

  it('asks for a reply when the message is a question', async () => {
    const { calls, channel } = fakeTelegram(() => ok({ message_id: 43 }));

    await channel.send('5551234', { text: 'Quanto foi?', askForReply: true });

    expect(calls[0].body.reply_markup).toEqual({
      force_reply: true,
      input_field_placeholder: '23,90',
    });
  });

  it('clears the buttons of an edited message that has none', async () => {
    const { calls, channel } = fakeTelegram(() => ok());

    await channel.edit('5551234', '42', { text: 'Desfeito.' });

    expect(calls[0]).toEqual({
      method: 'editMessageText',
      body: {
        chat_id: '5551234',
        message_id: 42,
        text: 'Desfeito.',
        reply_markup: { inline_keyboard: [] },
      },
    });
  });

  it('takes an edit that changes nothing as done', async () => {
    const { channel } = fakeTelegram(() => ({
      ok: false,
      error_code: 400,
      description:
        'Bad Request: message is not modified: specified new message content and reply markup are exactly the same',
    }));

    await expect(
      channel.edit('5551234', '42', { text: 'igual' }),
    ).resolves.toBeUndefined();
  });

  it('answers a tapped button, with its notice', async () => {
    const { calls, channel } = fakeTelegram(() => ok());

    await channel.answerButton('q1', 'Esta mensagem expirou.');

    expect(calls[0]).toEqual({
      method: 'answerCallbackQuery',
      body: { callback_query_id: 'q1', text: 'Esta mensagem expirou.' },
    });
  });

  it('lets a button answered too late go, as its work is already done', async () => {
    const { channel } = fakeTelegram(() => ({
      ok: false,
      error_code: 400,
      description:
        'Bad Request: query is too old and response timeout expired or query ID is invalid',
    }));

    await expect(channel.answerButton('q1')).resolves.toBeUndefined();
  });

  it('fails with what Telegram said, never with the bot token', async () => {
    const { channel } = fakeTelegram(() => ({
      ok: false,
      error_code: 403,
      description: 'Forbidden: bot was blocked by the user',
    }));

    const failure = channel.send('5551234', { text: 'oi' });

    await expect(failure).rejects.toThrow(
      'Telegram sendMessage failed (403): Forbidden: bot was blocked by the user',
    );
    await expect(failure).rejects.not.toThrow(TOKEN);
  });

  it('names the network failure, never with the bot token', async () => {
    const fetcher = (async () => {
      throw new TypeError(
        `fetch failed: https://api.telegram.org/bot${TOKEN}`,
        {
          cause: { code: 'ETIMEDOUT' },
        },
      );
    }) as typeof fetch;
    const channel = new TelegramChatChannel(new TelegramBotApi(TOKEN, fetcher));

    const failure = channel.send('5551234', { text: 'oi' });

    await expect(failure).rejects.toThrow(
      'Telegram sendMessage failed (no status): network error (ETIMEDOUT)',
    );
    await expect(failure).rejects.not.toThrow(TOKEN);
  });
});

describe('connecting to Telegram', () => {
  const original = net.getDefaultAutoSelectFamilyAttemptTimeout();
  afterEach(() => net.setDefaultAutoSelectFamilyAttemptTimeout(original));

  it('gives IPv4 time to connect before trying IPv6', () => {
    net.setDefaultAutoSelectFamilyAttemptTimeout(250);

    new TelegramBotApi(TOKEN);

    expect(
      net.getDefaultAutoSelectFamilyAttemptTimeout(),
    ).toBeGreaterThanOrEqual(2_000);
  });
});
