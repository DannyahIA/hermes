import { z } from 'zod';

import type { ChatUpdate } from '@/core/contracts/chat-channel';

const chat = z.object({ id: z.number(), type: z.string() });

/** The part of a Telegram Update Hermes reads (core.telegram.org/bots/api#update). */
const telegramUpdate = z.object({
  update_id: z.number(),
  message: z
    .object({
      message_id: z.number(),
      chat,
      from: z.object({ username: z.string().optional() }).optional(),
      text: z.string().optional(),
      reply_to_message: z.object({ message_id: z.number() }).optional(),
    })
    .optional(),
  callback_query: z
    .object({
      id: z.string(),
      data: z.string().optional(),
      message: z.object({ message_id: z.number(), chat }).optional(),
    })
    .optional(),
});

export type TelegramUpdate = z.input<typeof telegramUpdate>;

/** What a t.me start link can carry after "?start=". */
const START_CODE = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * A Telegram Update in Hermes' words, or null for what Hermes doesn't
 * answer: groups and channels (spec 2026-10-17-telegram-apple-pay-
 * design.md §5.1), and anything that isn't text or a button.
 */
export function toChatUpdate(raw: unknown): ChatUpdate | null {
  const parsed = telegramUpdate.safeParse(raw);
  if (!parsed.success) return null;
  const { message, callback_query: query } = parsed.data;

  if (query) {
    if (!query.data || query.message?.chat.type !== 'private') return null;
    return {
      kind: 'button',
      chatId: String(query.message.chat.id),
      messageId: String(query.message.message_id),
      buttonQueryId: query.id,
      data: query.data,
    };
  }

  if (!message || message.chat.type !== 'private' || !message.text) {
    return null;
  }
  const chatId = String(message.chat.id);
  const start = /^\/start(?:\s+(\S+))?\s*$/.exec(message.text);
  if (start) {
    const update: ChatUpdate = { kind: 'start', chatId };
    if (message.from?.username) update.username = message.from.username;
    if (start[1] && START_CODE.test(start[1])) update.code = start[1];
    return update;
  }
  const update: ChatUpdate = {
    kind: 'text',
    chatId,
    messageId: String(message.message_id),
    text: message.text,
  };
  if (message.reply_to_message) {
    update.replyToMessageId = String(message.reply_to_message.message_id);
  }
  return update;
}
