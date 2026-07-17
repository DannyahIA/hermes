import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

import { getDatabaseUrl } from '@/config/env';

const connectionString = getDatabaseUrl();
const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

async function main() {
  await migrate(db, { migrationsFolder: 'src/infra/database/migrations' });
  console.log('Database migrations completed successfully.');
}

main().catch((error) => {
  console.error('Database migration failed:', error);
  process.exit(1);
});
