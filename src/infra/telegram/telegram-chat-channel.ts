import type { ChatChannel, ChatMessage } from '@/core/contracts/chat-channel';

import {
  TelegramApiError,
  type TelegramBotApi,
} from './telegram-bot-api.client';

function replyMarkup(message: ChatMessage) {
  if (message.askForReply) {
    return { force_reply: true, input_field_placeholder: '23,90' };
  }
  return {
    inline_keyboard: (message.buttons ?? []).map((row) =>
      row.map((button) => ({ text: button.text, callback_data: button.data })),
    ),
  };
}

/** Telegram refuses an edit that leaves a message as it was; for Hermes that is done. */
function isUnchanged(error: unknown): boolean {
  return (
    error instanceof TelegramApiError &&
    error.description.includes('message is not modified')
  );
}

/**
 * A button can be answered only in the seconds after it was tapped; past
 * that (a slow update, a restarted worker) only the spinner is lost.
 */
function isTooLate(error: unknown): boolean {
  return (
    error instanceof TelegramApiError && error.description.includes('too old')
  );
}

/** Hermes' chat (`ChatChannel`) on a Telegram bot. */
export class TelegramChatChannel implements ChatChannel {
  readonly kind = 'telegram';

  constructor(private readonly api: TelegramBotApi) {}

  async send(chatId: string, message: ChatMessage) {
    const sent = await this.api.call<{ message_id: number }>('sendMessage', {
      chat_id: chatId,
      text: message.text,
      reply_markup: replyMarkup(message),
    });
    return { messageId: String(sent.message_id) };
  }

  async edit(chatId: string, messageId: string, message: ChatMessage) {
    try {
      await this.api.call('editMessageText', {
        chat_id: chatId,
        message_id: Number(messageId),
        text: message.text,
        // A question can't be edited into one; the buttons, if any, can be
        // replaced — or taken away with an empty keyboard.
        reply_markup: replyMarkup({ ...message, askForReply: false }),
      });
    } catch (error) {
      if (!isUnchanged(error)) throw error;
    }
  }

  async answerButton(buttonQueryId: string, notice?: string) {
    try {
      await this.api.call('answerCallbackQuery', {
        callback_query_id: buttonQueryId,
        ...(notice ? { text: notice } : {}),
      });
    } catch (error) {
      if (!isTooLate(error)) throw error;
    }
  }
}
