import { defineConfig } from 'drizzle-kit';

// drizzle-kit is a standalone CLI — it never gets `.env.local` loaded by
// Next.js, so this file has to load it itself (skip if absent, e.g. prod).
try {
  process.loadEnvFile('.env.local');
} catch {
  // No .env.local on disk — expected in production/CI.
}

// Deliberately reads process.env directly (not `@/config/env`) — drizzle-kit
// runs this file standalone, outside of Next.js's module resolution/aliases.
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run drizzle-kit.');
}

export default defineConfig({
  schema: './src/infra/database/schema.ts',
  out: './src/infra/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: true,
});
