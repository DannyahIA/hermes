import { describe, expect, it } from 'vitest';

import { ValidationError } from '@/core/errors/validation-error';

import { Email } from './email';

describe('Email', () => {
  it('normalizes case and trims whitespace', () => {
    expect(new Email('  Demo@Hermes.APP ').value).toBe('demo@hermes.app');
  });

  it('rejects a malformed address', () => {
    expect(() => new Email('not-an-email')).toThrow(ValidationError);
  });
});
