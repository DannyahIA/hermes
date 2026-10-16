import { describe, expect, it } from 'vitest';

import { resolveCategoryName, UNCATEGORIZED_KEY } from './category-key';

describe('resolveCategoryName', () => {
  it('returns "Sem categoria" for the uncategorized key', () => {
    expect(resolveCategoryName(UNCATEGORIZED_KEY, new Map())).toBe(
      'Sem categoria',
    );
  });

  it('returns the category name when found', () => {
    const categoriesById = new Map([['cat-1', { name: 'Alimentação' }]]);
    expect(resolveCategoryName('cat-1', categoriesById)).toBe('Alimentação');
  });

  it('returns "Categoria removida" when the id is unknown', () => {
    expect(resolveCategoryName('cat-deleted', new Map())).toBe(
      'Categoria removida',
    );
  });
});
