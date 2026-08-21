import type { Executor } from '@/infra/database/client';
import { db } from '@/infra/database/client';

/**
 * A unit of work: runs `work` inside a single Postgres transaction and
 * commits/rolls back atomically. This is how the application layer keeps a
 * transaction row and its account's balance update as one indivisible
 * operation (see `modules/transactions`), and how a money transfer's two
 * legs either both land or neither does.
 */
export async function withTransaction<T>(
  work: (tx: Executor) => Promise<T>,
): Promise<T> {
  return db.transaction((tx) => work(tx));
}
