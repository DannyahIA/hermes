import { describe, expect, it } from 'vitest';

import { occurrencesToGenerate, resolveOccurrenceDate } from './recurrence';

describe('resolveOccurrenceDate', () => {
  it('resolves a fixed day', () => {
    const date = resolveOccurrenceDate(2026, 7, {
      dayRuleKind: 'fixed_day',
      dayRuleDay: 8,
    });
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(7);
    expect(date.getDate()).toBe(8);
  });

  it('clamps a fixed day to the last real day of a shorter month', () => {
    // February 2026 has 28 days.
    const date = resolveOccurrenceDate(2026, 1, {
      dayRuleKind: 'fixed_day',
      dayRuleDay: 31,
    });
    expect(date.getMonth()).toBe(1);
    expect(date.getDate()).toBe(28);
  });

  it('resolves the first business day, skipping a weekend', () => {
    // August 2026 starts on a Saturday.
    const date = resolveOccurrenceDate(2026, 7, {
      dayRuleKind: 'first_business_day',
    });
    expect(date.getDay()).not.toBe(0);
    expect(date.getDay()).not.toBe(6);
    expect(date.getDate()).toBe(3); // Monday
  });

  it('resolves the last business day, skipping a weekend', () => {
    // August 2026 ends on a Monday (31st) — no skip needed.
    const date = resolveOccurrenceDate(2026, 7, {
      dayRuleKind: 'last_business_day',
    });
    expect(date.getDate()).toBe(31);

    // May 2026 ends on a Sunday (31st) — should roll back to Friday 29th.
    const may = resolveOccurrenceDate(2026, 4, {
      dayRuleKind: 'last_business_day',
    });
    expect(may.getDay()).not.toBe(0);
    expect(may.getDate()).toBe(29);
  });
});

describe('occurrencesToGenerate', () => {
  it('generates one occurrence per month from startDate through the target date', () => {
    const occurrences = occurrencesToGenerate(
      {
        dayRuleKind: 'fixed_day',
        dayRuleDay: 8,
        startDate: new Date(2026, 4, 1), // May 2026
      },
      new Date(2026, 6, 15), // through mid-July
    );

    expect(occurrences).toHaveLength(3); // May, June, July
    expect(occurrences[0].getMonth()).toBe(4);
    expect(occurrences[2].getMonth()).toBe(6);
  });

  it('resumes after lastGeneratedThrough instead of regenerating past months', () => {
    const occurrences = occurrencesToGenerate(
      {
        dayRuleKind: 'fixed_day',
        dayRuleDay: 8,
        startDate: new Date(2026, 0, 1),
        lastGeneratedThrough: new Date(2026, 4, 8), // already generated through May
      },
      new Date(2026, 6, 15),
    );

    expect(occurrences).toHaveLength(2); // June, July only
    expect(occurrences[0].getMonth()).toBe(5);
  });

  it('returns nothing when called again with the same "through" date (idempotent)', () => {
    const first = occurrencesToGenerate(
      {
        dayRuleKind: 'fixed_day',
        dayRuleDay: 8,
        startDate: new Date(2026, 4, 1),
      },
      new Date(2026, 6, 15),
    );
    const lastGeneratedThrough = first.at(-1);

    const second = occurrencesToGenerate(
      {
        dayRuleKind: 'fixed_day',
        dayRuleDay: 8,
        startDate: new Date(2026, 4, 1),
        lastGeneratedThrough,
      },
      new Date(2026, 6, 15),
    );

    expect(second).toHaveLength(0);
  });

  it('stops at endDate', () => {
    const occurrences = occurrencesToGenerate(
      {
        dayRuleKind: 'fixed_day',
        dayRuleDay: 1,
        startDate: new Date(2026, 0, 1),
        endDate: new Date(2026, 2, 15),
      },
      new Date(2026, 5, 1),
    );

    expect(occurrences).toHaveLength(3); // Jan, Feb, Mar only
  });
});
