import { timingSafeEqual } from 'node:crypto';

import { env } from '@/config/env';
import { telegramUpdateHandler } from '@/shared/server/chat';

function isSecret(given: string, secret: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Where Telegram pushes updates when Hermes has a public address (spec
 * 2026-10-17-telegram-apple-pay-design.md §8, §9 — the webhook mode of
 * D2). Off without TELEGRAM_WEBHOOK_SECRET; a call without that secret in
 * X-Telegram-Bot-Api-Secret-Token is turned away before anything is read.
 * Always answers 200 once in: Telegram would resend a failed update over
 * and over, and the failure is in the log.
 */
export async function POST(request: Request) {
  const secret = env.TELEGRAM_WEBHOOK_SECRET?.trim();
  const handle = secret ? telegramUpdateHandler() : null;
  if (!secret || !handle) return new Response(null, { status: 404 });

  const given = request.headers.get('x-telegram-bot-api-secret-token') ?? '';
  if (!isSecret(given, secret)) {
    return Response.json({ status: 'unauthorized' }, { status: 401 });
  }

  let update: unknown = null;
  try {
    update = await request.json();
  } catch {
    // Not JSON: nothing Hermes answers.
  }
  try {
    await handle(update);
  } catch (error) {
    console.error(
      'telegram update failed:',
      error instanceof Error ? error.message : 'unknown error',
    );
  }
  return Response.json({ ok: true });
}
