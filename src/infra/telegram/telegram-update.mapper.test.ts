import { describe, expect, it } from 'vitest';

import { toChatUpdate } from './telegram-update.mapper';

const privateChat = { id: 5551234, type: 'private' };
const from = { id: 5551234, username: 'dan' };

describe('reading what Telegram sends', () => {
  it('reads starting the bot, with the code from the app’s link', () => {
    expect(
      toChatUpdate({
        update_id: 1,
        message: {
          message_id: 10,
          chat: privateChat,
          from,
          text: '/start Zx3_-q9AbC',
        },
      }),
    ).toEqual({
      kind: 'start',
      chatId: '5551234',
      username: 'dan',
      code: 'Zx3_-q9AbC',
    });
    expect(
      toChatUpdate({
        update_id: 2,
        message: { message_id: 11, chat: privateChat, text: '/start' },
      }),
    ).toEqual({ kind: 'start', chatId: '5551234' });
  });

  it('reads a message, and which of Hermes’ messages it answers', () => {
    expect(
      toChatUpdate({
        update_id: 3,
        message: {
          message_id: 12,
          chat: privateChat,
          text: '23,90',
          reply_to_message: { message_id: 9 },
        },
      }),
    ).toEqual({
      kind: 'text',
      chatId: '5551234',
      messageId: '12',
      text: '23,90',
      replyToMessageId: '9',
    });
  });

  it('reads a tapped button', () => {
    expect(
      toChatUpdate({
        update_id: 4,
        callback_query: {
          id: 'q1',
          from,
          data: 'u:abc',
          message: { message_id: 20, chat: privateChat },
        },
      }),
    ).toEqual({
      kind: 'button',
      chatId: '5551234',
      messageId: '20',
      buttonQueryId: 'q1',
      data: 'u:abc',
    });
  });

  it('ignores groups, channels and what is not text', () => {
    const group = { id: -100, type: 'group' };
    expect(
      toChatUpdate({
        update_id: 5,
        message: { message_id: 1, chat: group, text: '/start abc' },
      }),
    ).toBeNull();
    expect(
      toChatUpdate({
        update_id: 6,
        callback_query: {
          id: 'q2',
          from,
          data: 'u:abc',
          message: { message_id: 1, chat: group },
        },
      }),
    ).toBeNull();
    expect(
      toChatUpdate({
        update_id: 7,
        message: { message_id: 2, chat: privateChat },
      }),
    ).toBeNull();
    expect(toChatUpdate({ update_id: 8 })).toBeNull();
  });
});
