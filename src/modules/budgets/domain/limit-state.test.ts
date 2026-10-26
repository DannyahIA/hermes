import { describe, expect, it } from 'vitest';

import { limitState } from './limit-state';

describe('limitState', () => {
  it('is under until spending reaches the limit', () => {
    expect(limitState(0, 500)).toBe('under');
    expect(limitState(499.99, 500)).toBe('under');
  });

  it('is at exactly the limit', () => {
    expect(limitState(500, 500)).toBe('at');
  });

  it('is over only once spending passes the limit', () => {
    expect(limitState(500.01, 500)).toBe('over');
    expect(limitState(900, 500)).toBe('over');
  });
});
