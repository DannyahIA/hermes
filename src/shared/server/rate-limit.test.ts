import { describe, expect, it } from 'vitest';

import { createRateLimiter } from './rate-limit';

describe('createRateLimiter', () => {
  it('lets a key through up to the limit within a window, then again in the next', () => {
    const allow = createRateLimiter(2, 60_000);

    expect(allow('token-1', 0)).toBe(true);
    expect(allow('token-1', 1_000)).toBe(true);
    expect(allow('token-1', 2_000)).toBe(false);
    expect(allow('token-2', 2_000)).toBe(true);
    expect(allow('token-1', 60_000)).toBe(true);
  });
});
