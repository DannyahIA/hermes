import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { getDatabaseUrl } from '@/config/env';
import { DATABASE_POOL_CONFIG } from '@/infra/database/config';
import * as schema from '@/infra/database/schema';

const connectionString = getDatabaseUrl();
const client = postgres(connectionString, {
  max: DATABASE_POOL_CONFIG.max,
  idle_timeout: DATABASE_POOL_CONFIG.idleTimeoutSeconds,
});

export const db = drizzle(client, { schema });
export type DatabaseClient = typeof db;

/**
 * Anything a repository can run a query against: the default pooled
 * connection, or an active unit-of-work transaction (see
 * `infra/database/transaction.ts`). Repositories accept this instead of
 * `DatabaseClient` so they can transparently participate in a larger atomic
 * operation.
 */
export type Executor =
  DatabaseClient | Parameters<Parameters<DatabaseClient['transaction']>[0]>[0];
