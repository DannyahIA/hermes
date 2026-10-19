import { describe, expect, it } from 'vitest';

import {
  captureIdempotencyKey,
  readWalletPayload,
  walletCardKey,
} from './wallet-payload';

const NOW = new Date('2026-10-19T15:41:27.000Z');

describe('readWalletPayload', () => {
  it('keeps what the shortcut sent, trimmed', () => {
    expect(
      readWalletPayload(
        {
          amount: 'R$ 23,90',
          merchant: '  PADARIA REAL LTDA ',
          card: ' Nubank ',
          occurredAt: '2026-10-19T12:41:05-03:00',
        },
        NOW,
      ),
    ).toEqual({
      amount: 'R$ 23,90',
      merchant: 'PADARIA REAL LTDA',
      card: 'Nubank',
      occurredAt: '2026-10-19T15:41:05.000Z',
    });
  });

  it('takes a number as it is and leaves out what is empty', () => {
    expect(
      readWalletPayload({ amount: 23.9, merchant: '', card: null }, NOW),
    ).toEqual({
      amount: 23.9,
      merchant: null,
      card: null,
      occurredAt: NOW.toISOString(),
    });
  });

  it('uses the time it arrived when the time sent is missing or not a time', () => {
    expect(readWalletPayload({ occurredAt: 'ontem' }, NOW).occurredAt).toBe(
      NOW.toISOString(),
    );
    expect(readWalletPayload(null, NOW)).toEqual({
      amount: null,
      merchant: null,
      card: null,
      occurredAt: NOW.toISOString(),
    });
  });

  it('cuts what is too long to keep', () => {
    const payload = readWalletPayload(
      { merchant: 'x'.repeat(400), card: 'y'.repeat(400) },
      NOW,
    );
    expect(payload.merchant).toHaveLength(255);
    expect(payload.card).toHaveLength(120);
  });
});

describe('walletCardKey', () => {
  it('ignores case, accents and spacing', () => {
    expect(walletCardKey('  Itaú   Visa ')).toBe('itau visa');
    expect(walletCardKey('ITAU VISA')).toBe('itau visa');
  });
});

describe('captureIdempotencyKey', () => {
  const payment = {
    amount: 'R$ 23,90',
    merchant: 'Padaria Real',
    card: 'Nubank',
    occurredAt: '2026-10-19T15:41:05.000Z',
  };

  it('is the same for a repeat within the same minute', () => {
    expect(
      captureIdempotencyKey({
        ...payment,
        amount: 23.9,
        card: 'NUBANK',
        occurredAt: '2026-10-19T15:41:59.000Z',
      }),
    ).toBe(captureIdempotencyKey(payment));
  });

  it('tells apart another amount, card or minute', () => {
    const key = captureIdempotencyKey(payment);
    expect(captureIdempotencyKey({ ...payment, amount: '23,91' })).not.toBe(
      key,
    );
    expect(captureIdempotencyKey({ ...payment, card: 'Itaú' })).not.toBe(key);
    expect(
      captureIdempotencyKey({
        ...payment,
        occurredAt: '2026-10-19T15:42:00.000Z',
      }),
    ).not.toBe(key);
  });
});
