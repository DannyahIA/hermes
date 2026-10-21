import { and, eq, isNull } from 'drizzle-orm';

import type { ChatLinkRepository } from '@/core/contracts/chat-link-repository';
import { type ChatChannelKind, ChatLink } from '@/core/entities/chat-link';
import { ChatLinkCode } from '@/core/entities/chat-link-code';
import type { Executor } from '@/infra/database/client';
import { db } from '@/infra/database/client';
import { chatLinkCodes, chatLinks } from '@/infra/database/schema';

type ChatLinkRow = typeof chatLinks.$inferSelect;

function toDomain(row: ChatLinkRow): ChatLink {
  return new ChatLink({
    id: row.id,
    userId: row.userId,
    channel: row.channel as ChatChannelKind,
    externalChatId: row.externalChatId,
    username: row.username ?? undefined,
    linkedAt: row.linkedAt,
    revokedAt: row.revokedAt ?? undefined,
  });
}

export class DrizzleChatLinkRepository implements ChatLinkRepository {
  constructor(private readonly executor: Executor = db) {}

  async findActiveByUserId(userId: string): Promise<ChatLink | null> {
    const [row] = await this.executor
      .select()
      .from(chatLinks)
      .where(and(eq(chatLinks.userId, userId), isNull(chatLinks.revokedAt)))
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async findActiveByChat(
    channel: ChatChannelKind,
    externalChatId: string,
  ): Promise<ChatLink | null> {
    const [row] = await this.executor
      .select()
      .from(chatLinks)
      .where(
        and(
          eq(chatLinks.channel, channel),
          eq(chatLinks.externalChatId, externalChatId),
          isNull(chatLinks.revokedAt),
        ),
      )
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async save(link: ChatLink): Promise<void> {
    const values = {
      username: link.username ?? null,
      revokedAt: link.props.revokedAt ?? null,
    };
    await this.executor
      .insert(chatLinks)
      .values({
        ...values,
        id: link.id,
        userId: link.userId,
        channel: link.props.channel,
        externalChatId: link.externalChatId,
        linkedAt: link.linkedAt,
      })
      .onConflictDoUpdate({ target: chatLinks.id, set: values });
  }

  async findCode(code: string): Promise<ChatLinkCode | null> {
    const [row] = await this.executor
      .select()
      .from(chatLinkCodes)
      .where(eq(chatLinkCodes.code, code))
      .limit(1);
    return row
      ? new ChatLinkCode({
          code: row.code,
          userId: row.userId,
          expiresAt: row.expiresAt,
          usedAt: row.usedAt ?? undefined,
        })
      : null;
  }

  async saveCode(code: ChatLinkCode): Promise<void> {
    const values = { usedAt: code.props.usedAt ?? null };
    await this.executor
      .insert(chatLinkCodes)
      .values({
        ...values,
        code: code.code,
        userId: code.userId,
        expiresAt: code.props.expiresAt,
      })
      .onConflictDoUpdate({ target: chatLinkCodes.code, set: values });
  }
}
