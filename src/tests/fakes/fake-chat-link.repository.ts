import type { ChatLinkRepository } from '@/core/contracts/chat-link-repository';
import type { ChatChannelKind, ChatLink } from '@/core/entities/chat-link';
import type { ChatLinkCode } from '@/core/entities/chat-link-code';

export class FakeChatLinkRepository implements ChatLinkRepository {
  readonly links = new Map<string, ChatLink>();
  private readonly codes = new Map<string, ChatLinkCode>();

  async findActiveByUserId(userId: string): Promise<ChatLink | null> {
    return (
      [...this.links.values()].find(
        (link) => link.userId === userId && link.active,
      ) ?? null
    );
  }

  async findActiveByChat(
    channel: ChatChannelKind,
    externalChatId: string,
  ): Promise<ChatLink | null> {
    return (
      [...this.links.values()].find(
        (link) =>
          link.props.channel === channel &&
          link.externalChatId === externalChatId &&
          link.active,
      ) ?? null
    );
  }

  async save(link: ChatLink): Promise<void> {
    this.links.set(link.id, link);
  }

  async findCode(code: string): Promise<ChatLinkCode | null> {
    return this.codes.get(code) ?? null;
  }

  async saveCode(code: ChatLinkCode): Promise<void> {
    this.codes.set(code.code, code);
  }
}
