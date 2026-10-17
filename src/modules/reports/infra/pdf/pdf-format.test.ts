import { describe, expect, it } from 'vitest';

import { formatDelta, formatPercent, formatPeriod } from './pdf-format';

describe('formatPercent', () => {
  it('uses the pt-BR decimal comma and drops a zero decimal by default', () => {
    expect(formatPercent(12.34)).toBe('12,3%');
    expect(formatPercent(7)).toBe('7%');
  });

  it('keeps one decimal in column mode so a column lines up on its comma', () => {
    expect(formatPercent(7, true)).toBe('7,0%');
  });
});

describe('formatDelta', () => {
  it('repeats the direction as an arrow and a sign, never color alone', () => {
    expect(formatDelta(12.38)).toBe('↑ +12,4%');
    expect(formatDelta(-48.32)).toBe('↓ −48,3%');
  });

  it('prints no arrow for no change', () => {
    expect(formatDelta(0)).toBe('0%');
  });
});

describe('formatPeriod', () => {
  it('prints both ends as dd/mm/aaaa', () => {
    expect(formatPeriod(new Date(2026, 0, 1), new Date(2026, 8, 30))).toBe(
      '01/01/2026 a 30/09/2026',
    );
  });
});
