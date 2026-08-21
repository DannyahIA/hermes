import { eq } from 'drizzle-orm';

import type { UserRepository } from '@/core/contracts/user-repository';
import { User } from '@/core/entities/user';
import type { Executor } from '@/infra/database/client';
import { db } from '@/infra/database/client';
import { user as userTable } from '@/infra/database/schema';

type UserRow = typeof userTable.$inferSelect;

function toDomain(row: UserRow): User {
  return new User({
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

/**
 * Reads the app-level `User` domain entity from the same `user` table
 * better-auth owns. Account creation/credential changes always go through
 * better-auth (`infra/auth`) — this repository only ever reads, plus
 * updates the non-credential profile fields (`name`).
 */
export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly executor: Executor = db) {}

  async findById(id: string): Promise<User | null> {
    const [row] = await this.executor
      .select()
      .from(userTable)
      .where(eq(userTable.id, id))
      .limit(1);

    return row ? toDomain(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [row] = await this.executor
      .select()
      .from(userTable)
      .where(eq(userTable.email, email))
      .limit(1);

    return row ? toDomain(row) : null;
  }

  async save(user: User): Promise<void> {
    await this.executor
      .update(userTable)
      .set({ name: user.name, updatedAt: user.updatedAt })
      .where(eq(userTable.id, user.id));
  }

  async delete(id: string): Promise<void> {
    await this.executor.delete(userTable).where(eq(userTable.id, id));
  }
}
