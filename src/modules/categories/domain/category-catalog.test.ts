import { expect, it } from 'vitest';

import {
  catalogCategoryByKey,
  catalogCategoryFor,
  sameCategoryName,
} from './category-catalog';

it.each([
  ['FARMÁCIA SÃO JOÃO S/A', 'saude'],
  ['Drogasil 24h', 'saude'],
  ['DROGARIA PAGUE MENOS', 'saude'],
  ['Uber *Trip', 'transporte'],
  ['POSTO SHELL 0123', 'transporte'],
  ['PETZ', 'pets'],
  ['Netflix.com', 'assinaturas'],
  ['Padaria Real', null],
])('recognizes %s', (description, key) => {
  expect(catalogCategoryFor(description)?.key ?? null).toBe(key);
});
it('compares names without accents, case or plural', () => {
  expect(sameCategoryName('Saúde', 'saude')).toBe(true);
  expect(sameCategoryName('Assinatura', 'Assinaturas')).toBe(true);
  expect(sameCategoryName('Saúde', 'Mercado')).toBe(false);
  expect(sameCategoryName('123', '456')).toBe(false);
});
it('finds a catalog category by its key', () => {
  expect(catalogCategoryByKey('saude')?.name).toBe('Saúde');
  expect(catalogCategoryByKey('nada')).toBeNull();
});
