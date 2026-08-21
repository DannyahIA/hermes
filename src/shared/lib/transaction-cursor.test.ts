import { describe, expect, it } from 'vitest';

import {
  decodeTransactionCursor,
  encodeTransactionCursor,
} from '@/shared/lib/transaction-cursor';

describe('transaction cursor', () => {
  it('round-trips occurredAt and id', () => {
    const original = {
      occurredAt: new Date('2026-06-15T12:00:00.000Z'),
      id: 'abc-123',
    };
    const encoded = encodeTransactionCursor(original);
    const decoded = decodeTransactionCursor(encoded);

    expect(decoded).not.toBeNull();
    expect(decoded?.id).toBe(original.id);
    expect(decoded?.occurredAt.toISOString()).toBe(
      original.occurredAt.toISOString(),
    );
  });

  it('is opaque base64, not raw JSON', () => {
    const encoded = encodeTransactionCursor({
      occurredAt: new Date(),
      id: 'x',
    });
    expect(() => JSON.parse(encoded)).toThrow();
  });

  it('returns null for garbage input', () => {
    expect(decodeTransactionCursor('not-a-valid-cursor')).toBeNull();
  });

  it('returns null for well-formed base64 that is not a valid cursor shape', () => {
    const encoded = Buffer.from(JSON.stringify({ foo: 'bar' })).toString(
      'base64url',
    );
    expect(decodeTransactionCursor(encoded)).toBeNull();
  });
});
