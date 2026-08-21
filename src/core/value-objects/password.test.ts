import { describe, expect, it } from 'vitest';

import { ValidationError } from '@/core/errors/validation-error';

import { Password } from './password';

describe('Password', () => {
  it('rejects a password shorter than 8 characters', () => {
    expect(() => new Password('Ab1')).toThrow(ValidationError);
  });

  it('rejects a password missing a required character class', () => {
    expect(() => new Password('alllowercase1')).toThrow(ValidationError);
  });

  it('accepts a strong password', () => {
    expect(new Password('Demo12345').value).toBe('Demo12345');
  });
});
