import { describe, expect, it } from 'vitest';

import { ValidationError } from '@/core/errors/validation-error';

import { Money } from './money';

describe('Money', () => {
  it('rejects a non-finite amount', () => {
    expect(() => new Money(Number.NaN, 'BRL')).toThrow(ValidationError);
  });

  it('adds two amounts in the same currency', () => {
    const total = new Money(10, 'BRL').add(new Money(5, 'BRL'));
    expect(total.value).toBe(15);
  });

  it('refuses to add mismatched currencies', () => {
    expect(() => new Money(10, 'BRL').add(new Money(5, 'USD'))).toThrow(
      ValidationError,
    );
  });
});
