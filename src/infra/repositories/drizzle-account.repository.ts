import { eq } from 'drizzle-orm';

import type { AccountRepository } from '@/core/contracts/account-repository';
import { Account, type AccountKind } from '@/core/entities/account';
import type { Executor } from '@/infra/database/client';
import { db } from '@/infra/database/client';
import { accounts } from '@/infra/database/schema';

type AccountRow = typeof accounts.$inferSelect;

function toDomain(row: AccountRow): Account {
  return new Account({
    id: row.id,
    userId: row.userId,
    name: row.name,
    type: row.type as AccountKind,
    balance: Number(row.balance),
    currency: row.currency,
    archived: row.archived,
    hidden: row.hidden,
    closingDay: row.closingDay ?? undefined,
    dueDay: row.dueDay ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

/**
 * Drizzle-backed implementation of `AccountRepository`. Accepts the query
 * executor (default connection, or an active unit-of-work transaction) so
 * callers can keep an account write inside a larger atomic operation.
 */
export class DrizzleAccountRepository implements AccountRepository {
  constructor(private readonly executor: Executor = db) {}

  async findById(id: string): Promise<Account | null> {
    const [row] = await this.executor
      .select()
      .from(accounts)
      .where(eq(accounts.id, id))
      .limit(1);

    return row ? toDomain(row) : null;
  }

  async findByUserId(userId: string): Promise<Account[]> {
    const rows = await this.executor
      .select()
      .from(accounts)
      .where(eq(accounts.userId, userId));

    return rows.map(toDomain);
  }

  async save(account: Account): Promise<void> {
    const values = {
      id: account.id,
      userId: account.userId,
      name: account.name,
      type: account.type,
      balance: account.balance.toFixed(2),
      currency: account.currency,
      archived: account.archived,
      hidden: account.hidden,
      closingDay: account.closingDay ?? null,
      dueDay: account.dueDay ?? null,
      updatedAt: account.props.updatedAt,
    };

    await this.executor
      .insert(accounts)
      .values({ ...values, createdAt: account.props.createdAt })
      .onConflictDoUpdate({ target: accounts.id, set: values });
  }

  async delete(id: string): Promise<void> {
    await this.executor.delete(accounts).where(eq(accounts.id, id));
  }
}
