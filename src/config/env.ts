import { z } from 'zod';

/**
 * Next.js loads `.env.local` into `process.env` on its own before any app
 * code runs — but standalone scripts (`db:migrate`, `db:seed`, drizzle-kit)
 * are plain Node/tsx processes that never do that. Loading it here, once,
 * covers both: redundant-but-harmless under Next, required under tsx. Safe
 * to skip when the file doesn't exist (e.g. production, where real env vars
 * are injected by the platform instead).
 */
try {
  process.loadEnvFile('.env.local');
} catch {
  // No .env.local on disk — expected in production/CI.
}

/**
 * Every environment variable the app depends on is validated once, at module
 * load time, so a missing/invalid value fails fast with a clear message
 * instead of surfacing as a cryptic runtime error deep in a request.
 */
const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .url('DATABASE_URL must be a valid connection string.'),
  DATABASE_POOL_URL: z
    .string()
    .url('DATABASE_POOL_URL must be a valid connection string.')
    .optional(),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, 'BETTER_AUTH_SECRET must be at least 32 characters long.'),
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url('NEXT_PUBLIC_APP_URL must be a valid URL.')
    .default('http://localhost:3000'),
  // Optional: where the iPhone reaches Hermes from anywhere, e.g. the
  // Tailscale address (https://hermes.tail1234.ts.net). The iPhone shortcut
  // recipe in Configurações uses it; NEXT_PUBLIC_APP_URL when unset.
  CAPTURE_BASE_URL: z
    .string()
    .url('CAPTURE_BASE_URL must be a valid URL.')
    .optional(),
  // Optional: the Telegram bot that announces captured payments (spec
  // 2026-10-17-telegram-apple-pay-design.md §9). Create it with @BotFather;
  // the username goes without the "@". Without both, Hermes says nothing
  // in Telegram and the captures still land.
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_BOT_USERNAME: z.string().optional(),
  // Optional, webhook mode only: the secret Telegram repeats in
  // X-Telegram-Bot-Api-Secret-Token. Without it, /api/telegram/webhook is
  // off and `pnpm telegram:poll` is the way updates come in.
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  // Optional: when unset, transactional emails (verification, password
  // reset) fall back to logging the link to the server console instead of
  // failing — see infra/email/resend-email-sender.adapter.ts.
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Hermes <onboarding@resend.dev>'),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `Invalid environment variables. Check your .env.local file:\n${issues}`,
    );
  }

  return parsed.data;
}

export const env = loadEnv();

export function getDatabaseUrl(): string {
  return env.DATABASE_URL;
}

export function isGithubAuthConfigured(): boolean {
  return Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
}

export function isGoogleAuthConfigured(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

/** The bot's token and username ("hermes_dan_bot"), or null without both. */
export function getTelegramBot(): { token: string; username: string } | null {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const username = env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, '');
  return token && username ? { token, username } : null;
}

export function isEmailSendingConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY);
}
