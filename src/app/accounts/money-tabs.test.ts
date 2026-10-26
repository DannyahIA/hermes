import { describe, expect, it } from 'vitest';

import { readMoneyTab } from '@/app/accounts/money-tabs';

describe('readMoneyTab', () => {
  it('reads the tab from ?aba, defaulting to budgets', () => {
    expect(readMoneyTab({})).toBe('orcamentos');
    expect(readMoneyTab({ aba: 'emprestimos' })).toBe('emprestimos');
    expect(readMoneyTab({ aba: 'x' })).toBe('orcamentos');
    expect(readMoneyTab({ aba: ['emprestimos', 'orcamentos'] })).toBe(
      'emprestimos',
    );
  });
});
