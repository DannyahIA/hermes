import { describe, expect, it } from 'vitest';

import { parseAmount } from './parse-amount';

describe('parseAmount', () => {
  it.each([
    ['32', 32],
    ['32,50', 32.5],
    ['32,5', 32.5],
    ['0,99', 0.99],
    ['1234,56', 1234.56],
    ['1.234,56', 1234.56],
    ['1.234.567,89', 1234567.89],
    ['1.234', 1234],
    ['23.9', 23.9],
    ['1234.56', 1234.56],
    ['1,234.56', 1234.56],
    ['R$ 23,90', 23.9],
    ['R$23,90', 23.9],
    ['r$ 1.234,56', 1234.56],
    // Intl.NumberFormat puts a no-break space after "R$".
    ['R$ 1.234,56', 1234.56],
    ['  23,90  ', 23.9],
    ['+3000', 3000],
    ['-23,90', -23.9],
    ['- R$ 23,90', -23.9],
    // Halfway through typing "12,50".
    ['12,', 12],
  ])('reads %j as %d', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it('takes a number as it is, to the cent', () => {
    expect(parseAmount(23.9)).toBe(23.9);
    expect(parseAmount(0.1 + 0.2)).toBe(0.3);
  });

  it.each([
    [''],
    ['abc'],
    ['R$'],
    ['12a'],
    ['1.23.4'],
    ['1,2,3'],
    ['12,345,67'],
    // A comma followed by three digits is either 32.505 or 32505.
    ['32,505'],
    ['23,999'],
    ['1.234,5678'],
    ['++3'],
  ])('refuses %j', (input) => {
    expect(parseAmount(input)).toBeNull();
  });

  it('refuses a number that is not finite', () => {
    expect(parseAmount(Number.NaN)).toBeNull();
    expect(parseAmount(Number.POSITIVE_INFINITY)).toBeNull();
  });
});
