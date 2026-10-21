import { after, type NextRequest } from 'next/server';

import { withTransaction } from '@/infra/database/transaction';
import { DrizzleApiTokenRepository } from '@/infra/repositories/drizzle-api-token.repository';
import { AuthenticateCaptureTokenUseCase } from '@/modules/capture/application/capture-tokens.use-case';
import { CaptureWalletPaymentUseCase } from '@/modules/capture/application/capture-wallet-payment.use-case';
import { readWalletPayload } from '@/modules/capture/domain/wallet-payload';
import { captureDependencies } from '@/shared/server/capture-dependencies';
import { announceCaptures } from '@/shared/server/chat';
import { createRateLimiter } from '@/shared/server/rate-limit';
import { revalidateMoneyPages } from '@/shared/server/revalidate-money-pages';

/** Spec 2026-10-17-telegram-apple-pay-design.md §8: 30 a minute per token. */
const allow = createRateLimiter(30, 60_000);

/** Postgres' unique_violation: the same payment, reported twice at once. */
function isRepeatRace(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    ((error as { code?: string }).code === '23505' ||
      (error as { cause?: { code?: string } }).cause?.code === '23505')
  );
}

/**
 * Where the iPhone shortcut reports an Apple Pay payment (spec
 * 2026-10-17-telegram-apple-pay-design.md §5.3, §7). Answers only
 * `{ "status": "ok" }` — never a balance or an account — so a token that
 * leaks can record payments but read nothing. Logs carry capture ids, never
 * the token or what was paid.
 */
export async function POST(request: NextRequest) {
  const header = request.headers.get('authorization') ?? '';
  const token = /^Bearer\s+(\S+)$/i.exec(header)?.[1] ?? '';
  const apiToken = await new AuthenticateCaptureTokenUseCase(
    new DrizzleApiTokenRepository(),
  ).execute(token);
  if (!apiToken) {
    return Response.json({ status: 'unauthorized' }, { status: 401 });
  }
  if (!allow(apiToken.id)) {
    return Response.json(
      { status: 'too_many_requests' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    // Not JSON: answered below like a body with nothing in it.
  }
  const payload = readWalletPayload(body, new Date());
  // A shortcut set up wrong sends nothing usable; saying so lets its
  // "not ok" check warn on the iPhone, instead of keeping an empty payment.
  if (!payload.amount && !payload.merchant && !payload.card) {
    return Response.json({ status: 'invalid' }, { status: 400 });
  }
  const capture = () =>
    withTransaction((tx) =>
      new CaptureWalletPaymentUseCase(captureDependencies(tx)).execute({
        userId: apiToken.userId,
        payload,
      }),
    );

  try {
    let result;
    try {
      result = await capture();
    } catch (error) {
      if (!isRepeatRace(error)) throw error;
      result = await capture();
    }
    if (result.status === 'recorded' && !result.repeated) {
      revalidateMoneyPages();
    }
    // Told in the chat once the shortcut has its answer, so a slow
    // Telegram never makes the iPhone wait.
    if (!result.repeated) {
      after(() => announceCaptures(apiToken.userId, [result.captureId]));
    }
    console.info(
      `capture ${result.captureId}: ${result.status}${result.repeated ? ', repeated' : ''}`,
    );
    return Response.json({ status: 'ok', capture: result.status });
  } catch (error) {
    console.error(
      'capture failed:',
      error instanceof Error ? error.message : 'unknown error',
    );
    return Response.json({ status: 'error' }, { status: 500 });
  }
}
