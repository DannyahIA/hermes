import { describe, expect, it } from 'vitest';

import { splitPastLimit } from './split-past-limit';

describe('splitPastLimit', () => {
  it('returns everything as head when the list is within the limit', () => {
    expect(splitPastLimit([1, 2, 3], 6)).toEqual({ head: [1, 2, 3], tail: [] });
  });

  it('keeps exactly limit-1 items in head and folds the rest into tail, past the limit', () => {
    const items = [1, 2, 3, 4, 5, 6, 7];
    const result = splitPastLimit(items, 6);
    expect(result.head).toEqual([1, 2, 3, 4, 5]);
    expect(result.tail).toEqual([6, 7]);
  });

  it('treats a list exactly at the limit as all head, no fold', () => {
    const items = [1, 2, 3, 4, 5, 6];
    expect(splitPastLimit(items, 6)).toEqual({ head: items, tail: [] });
  });
});
