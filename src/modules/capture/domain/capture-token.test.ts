import { describe, expect, it } from 'vitest';

import { generateCaptureToken, hashCaptureToken } from './capture-token';

describe('capture tokens', () => {
  it('are random, recognizable, and stored only as a hash', () => {
    const first = generateCaptureToken();
    const second = generateCaptureToken();

    expect(first.token).toMatch(/^hm_[A-Za-z0-9_-]{43}$/);
    expect(first.token).not.toBe(second.token);
    expect(first.prefix).toBe(first.token.slice(0, 9));
    expect(first.hash).toBe(hashCaptureToken(first.token));
    expect(first.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.hash).not.toContain(first.token.slice(3));
  });
});
