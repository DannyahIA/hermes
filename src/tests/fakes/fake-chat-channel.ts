import type { ChatChannel, ChatMessage } from '@/core/contracts/chat-channel';

/** Records what would have been said in the chat. */
export class FakeChatChannel implements ChatChannel {
  readonly kind = 'telegram';
  readonly sent: Array<{ chatId: string; messageId: string } & ChatMessage> =
    [];
  readonly edited: Array<{ chatId: string; messageId: string } & ChatMessage> =
    [];
  readonly answered: Array<{ buttonQueryId: string; notice?: string }> = [];
  private next = 100;

  async send(chatId: string, message: ChatMessage) {
    const messageId = String(this.next++);
    this.sent.push({ chatId, messageId, ...message });
    return { messageId };
  }

  async edit(chatId: string, messageId: string, message: ChatMessage) {
    this.edited.push({ chatId, messageId, ...message });
  }

  async answerButton(buttonQueryId: string, notice?: string) {
    this.answered.push({ buttonQueryId, notice });
  }

  /** The latest text shown in a message, sent or edited. */
  latest(messageId: string): ChatMessage | undefined {
    return [...this.sent, ...this.edited]
      .filter((message) => message.messageId === messageId)
      .at(-1);
  }
}
