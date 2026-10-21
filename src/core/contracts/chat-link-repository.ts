import type { ChatChannelKind, ChatLink } from '@/core/entities/chat-link';
import type { ChatLinkCode } from '@/core/entities/chat-link-code';

export interface ChatLinkRepository {
  findActiveByUserId(userId: string): Promise<ChatLink | null>;
  findActiveByChat(
    channel: ChatChannelKind,
    externalChatId: string,
  ): Promise<ChatLink | null>;
  save(link: ChatLink): Promise<void>;
  findCode(code: string): Promise<ChatLinkCode | null>;
  saveCode(code: ChatLinkCode): Promise<void>;
}
