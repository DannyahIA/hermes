import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { getDatabaseUrl } from '@/config/env';

const connectionString = getDatabaseUrl();
const client = postgres(connectionString, { max: 10 });

export const db = drizzle(client);
export type DatabaseClient = typeof db;
