import { describe, expect, it } from 'vitest';

import { formatPercent } from './format-percent';

describe('formatPercent', () => {
  it('uses a comma as the decimal separator', () => {
    expect(formatPercent(12.34, 1)).toBe('12,3%');
  });

  it('rounds to whole percents by default', () => {
    expect(formatPercent(16.7)).toBe('17%');
  });

  it('keeps the sign of a negative change', () => {
    expect(formatPercent(-4.25, 1)).toBe('-4,3%');
  });
});
