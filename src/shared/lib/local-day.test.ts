import { describe, expect, it } from 'vitest';

import { localDay } from './local-day';

describe('localDay', () => {
  it('reads a date input as the start or end of that day, in local time', () => {
    expect(localDay('2026-10-31', 'start')).toEqual(new Date(2026, 9, 31));
    expect(localDay('2026-10-31', 'end')).toEqual(
      new Date(2026, 9, 31, 23, 59, 59, 999),
    );
  });

  it('passes anything else through untouched', () => {
    expect(localDay('', 'start')).toBe('');
    expect(localDay(null, 'end')).toBeNull();
    expect(localDay('2026-10-31T10:00', 'start')).toBe('2026-10-31T10:00');
  });
});
