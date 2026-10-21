import { describe, expect, it } from 'vitest';

import { dayLabel, momentLabel } from './moment-label';

const NOW = new Date(2026, 9, 19, 15, 0);

describe('when a payment happened, as its message says it', () => {
  it('names today and yesterday, and dates the rest', () => {
    expect(momentLabel(new Date(2026, 9, 19, 12, 41), NOW)).toBe('hoje 12:41');
    expect(momentLabel(new Date(2026, 9, 18, 23, 5), NOW)).toBe('ontem 23:05');
    expect(momentLabel(new Date(2026, 9, 17, 9, 12), NOW)).toBe('17/10 09:12');
  });

  it('leaves out the time of an entry dated with a day only', () => {
    expect(momentLabel(new Date(2026, 9, 18), NOW)).toBe('ontem');
    expect(momentLabel(new Date(2026, 9, 12), NOW)).toBe('12/10');
  });

  it('says the day alone for what is still to come', () => {
    expect(dayLabel(new Date(2026, 9, 19, 12, 41), NOW)).toBe('hoje');
    expect(dayLabel(new Date(2026, 10, 19, 12, 41), NOW)).toBe('em 19/11');
  });
});
