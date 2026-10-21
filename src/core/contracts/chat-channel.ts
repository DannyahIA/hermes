import type { ChatChannelKind } from '@/core/entities/chat-link';

/** A button under a message; `data` comes back when it is tapped (64 bytes at most). */
export interface ChatButton {
  text: string;
  data: string;
}

export interface ChatMessage {
  text: string;
  /** Rows of buttons. */
  buttons?: ChatButton[][];
  /** Asks the person to answer this message (no buttons then). */
  askForReply?: boolean;
}

/**
 * Where Hermes talks to the user (spec 2026-10-17-telegram-apple-pay-
 * design.md §4.1). Telegram implements it; another chat app could.
 */
export interface ChatChannel {
  readonly kind: ChatChannelKind;
  send(chatId: string, message: ChatMessage): Promise<{ messageId: string }>;
  edit(chatId: string, messageId: string, message: ChatMessage): Promise<void>;
  /** Acknowledges a tapped button, with an optional short notice. */
  answerButton(buttonQueryId: string, notice?: string): Promise<void>;
}

/**
 * What arrives from a private chat, in Hermes' words: the bot started
 * (with the code of a "Abrir no Telegram" link, when it came from one), a
 * button tapped under one of its messages, or a message written — maybe
 * as the answer to one of its questions.
 */
export type ChatUpdate =
  | { kind: 'start'; chatId: string; username?: string; code?: string }
  | {
      kind: 'button';
      chatId: string;
      messageId: string;
      buttonQueryId: string;
      data: string;
    }
  | {
      kind: 'text';
      chatId: string;
      /** Unique within the chat: the same message arriving twice is one entry. */
      messageId: string;
      text: string;
      /** The message of Hermes' it answers. */
      replyToMessageId?: string;
    };
