export interface TransactionCursor {
  occurredAt: Date;
  id: string;
}

/**
 * The cursor is opaque to callers — a base64url blob, never raw JSON — so
 * its internal shape can change without breaking the `GET /api/transactions`
 * contract. Encodes `(occurredAt, id)`, the same pair the keyset-pagination
 * query orders and filters by (see drizzle-transaction.repository.ts).
 */
export function encodeTransactionCursor(cursor: TransactionCursor): string {
  const payload = JSON.stringify({
    occurredAt: cursor.occurredAt.toISOString(),
    id: cursor.id,
  });
  return Buffer.from(payload, 'utf8').toString('base64url');
}

export function decodeTransactionCursor(
  value: string,
): TransactionCursor | null {
  try {
    const payload = Buffer.from(value, 'base64url').toString('utf8');
    const parsed = JSON.parse(payload) as {
      occurredAt?: unknown;
      id?: unknown;
    };

    if (typeof parsed.occurredAt !== 'string' || typeof parsed.id !== 'string')
      return null;

    const occurredAt = new Date(parsed.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) return null;

    return { occurredAt, id: parsed.id };
  } catch {
    return null;
  }
}
