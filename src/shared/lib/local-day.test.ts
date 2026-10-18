import { describe, expect, it } from 'vitest';

import { localDay, toDateInput } from './local-day';

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

describe('toDateInput', () => {
  it('names the local day, even late in the evening', () => {
    expect(toDateInput(new Date(2026, 9, 18, 22, 30))).toBe('2026-10-18');
    expect(toDateInput(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('round-trips with localDay', () => {
    const evening = new Date(2026, 11, 31, 23, 15);
    expect(localDay(toDateInput(evening), 'start')).toEqual(
      new Date(2026, 11, 31),
    );
  });
});
