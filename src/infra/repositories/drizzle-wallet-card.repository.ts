import { and, asc, eq } from 'drizzle-orm';

import type { WalletCardRepository } from '@/core/contracts/wallet-card-repository';
import { WalletCard } from '@/core/entities/wallet-card';
import type { Executor } from '@/infra/database/client';
import { db } from '@/infra/database/client';
import { walletCards } from '@/infra/database/schema';

type WalletCardRow = typeof walletCards.$inferSelect;

function toDomain(row: WalletCardRow): WalletCard {
  return new WalletCard({
    id: row.id,
    userId: row.userId,
    walletName: row.walletName,
    nameKey: row.nameKey,
    accountId: row.accountId ?? undefined,
    alternateAccountId: row.alternateAccountId ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export class DrizzleWalletCardRepository implements WalletCardRepository {
  constructor(private readonly executor: Executor = db) {}

  async findById(id: string): Promise<WalletCard | null> {
    const [row] = await this.executor
      .select()
      .from(walletCards)
      .where(eq(walletCards.id, id))
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async findByKey(userId: string, nameKey: string): Promise<WalletCard | null> {
    const [row] = await this.executor
      .select()
      .from(walletCards)
      .where(
        and(eq(walletCards.userId, userId), eq(walletCards.nameKey, nameKey)),
      )
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async findByUserId(userId: string): Promise<WalletCard[]> {
    const rows = await this.executor
      .select()
      .from(walletCards)
      .where(eq(walletCards.userId, userId))
      .orderBy(asc(walletCards.createdAt));
    return rows.map(toDomain);
  }

  async save(card: WalletCard): Promise<void> {
    const values = {
      walletName: card.walletName,
      accountId: card.accountId ?? null,
      alternateAccountId: card.alternateAccountId ?? null,
      updatedAt: card.props.updatedAt,
    };
    await this.executor
      .insert(walletCards)
      .values({
        ...values,
        id: card.id,
        userId: card.userId,
        nameKey: card.nameKey,
        createdAt: card.props.createdAt,
      })
      .onConflictDoUpdate({ target: walletCards.id, set: values });
  }
}
