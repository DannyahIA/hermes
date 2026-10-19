import type { CapturePayload } from '@/core/entities/capture-event';
import { foldText } from '@/shared/lib/fold-text';

import { parseAmount } from './parse-amount';

const MERCHANT_MAX = 255;
const CARD_MAX = 120;

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/**
 * What the iPhone shortcut sent, as a capture keeps it: the amount as it
 * came (text or number; `parseAmount` reads it later), the merchant and
 * the card trimmed, and the moment of the payment — the time it arrived
 * when the one sent is missing or isn't a time.
 */
export function readWalletPayload(body: unknown, now: Date): CapturePayload {
  const fields =
    body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const amount =
    typeof fields.amount === 'number' && Number.isFinite(fields.amount)
      ? fields.amount
      : text(fields.amount, 32);
  const sent =
    typeof fields.occurredAt === 'string' ? new Date(fields.occurredAt) : null;

  return {
    amount,
    merchant: text(fields.merchant, MERCHANT_MAX),
    card: text(fields.card, CARD_MAX),
    occurredAt: (sent && !Number.isNaN(sent.getTime())
      ? sent
      : now
    ).toISOString(),
  };
}

/** A Wallet card's name without case, accents or extra spaces. */
export function walletCardKey(name: string): string {
  return foldText(name).replace(/\s+/g, ' ').trim();
}

/**
 * The same payment reported twice — a shortcut retried, a tap counted
 * twice — has the same card, amount and minute.
 */
export function captureIdempotencyKey(payload: CapturePayload): string {
  const amount = payload.amount === null ? null : parseAmount(payload.amount);
  const minute = payload.occurredAt.slice(0, 16);
  return [
    walletCardKey(payload.card ?? ''),
    amount === null ? 'sem-valor' : amount.toFixed(2),
    minute,
  ].join('|');
}
