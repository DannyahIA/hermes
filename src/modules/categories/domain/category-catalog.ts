import { normalizeMerchant } from '@/modules/capture/domain/normalize-merchant';

/**
 * A common category the app can suggest before the user has it. `words` are
 * folded (no accents, lowercase) and match a whole word or phrase of a
 * merchant's normalized key.
 */
export interface CatalogCategory {
  key: string;
  name: string;
  color: string;
  words: string[];
}

/** What a suggested new category needs to be shown and created. */
export type NewCategoryHint = Pick<CatalogCategory, 'key' | 'name' | 'color'>;

/**
 * The common categories the app suggests for purchases the user has not
 * filed yet (spec 2026-10-19-contas-planejamento-categorias-design.md §5.1).
 * It is data, meant to grow: add a category or a word here, not in the
 * matching code. The first category with a matching word wins.
 */
export const CATEGORY_CATALOG: CatalogCategory[] = [
  {
    key: 'saude',
    name: 'Saúde',
    color: '#ef4444',
    words: [
      'farmacia',
      'drogaria',
      'drogasil',
      'raia',
      'droga raia',
      'pague menos',
      'panvel',
      'clinica',
      'laboratorio',
      'hospital',
      'dentista',
    ],
  },
  {
    key: 'transporte',
    name: 'Transporte',
    color: '#3b82f6',
    words: [
      'uber',
      'posto',
      'combustivel',
      'estacionamento',
      'pedagio',
      'sem parar',
      'metro',
    ],
  },
  {
    key: 'pets',
    name: 'Pets',
    color: '#f59e0b',
    words: ['petz', 'cobasi', 'pet shop', 'petshop', 'veterinario'],
  },
  {
    key: 'assinaturas',
    name: 'Assinaturas',
    color: '#8b5cf6',
    words: [
      'netflix',
      'spotify',
      'prime video',
      'disney',
      'icloud',
      'youtube premium',
    ],
  },
  {
    key: 'educacao',
    name: 'Educação',
    color: '#10b981',
    words: ['escola', 'curso', 'faculdade', 'livraria', 'udemy'],
  },
  {
    key: 'casa',
    name: 'Casa',
    color: '#a16207',
    words: ['leroy merlin', 'telhanorte', 'material de construcao'],
  },
];

/** Same rule as the singular in parse-quick-entry.ts ("Restaurante" for "Restaurantes"); keep the two in step. */
function singular(key: string): string {
  return key.endsWith('s') ? key.slice(0, -1) : key;
}

/** Trimmed, lowercased and accent-free: how a name with no letters is compared. */
function fold(name: string): string {
  return name
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * Whether two category names are the same one: "Saúde" and "saude", or
 * "Assinatura" and "Assinaturas". A name with no letters ("123") is compared
 * as written, so "123" and "456" are not the same.
 */
export function sameCategoryName(a: string, b: string): boolean {
  const keyA = normalizeMerchant(a).key;
  const keyB = normalizeMerchant(b).key;
  if (!keyA || !keyB) return fold(a) === fold(b);
  return keyA === keyB || singular(keyA) === singular(keyB);
}

/**
 * The catalog category a merchant or description belongs to, or null.
 * "FARMÁCIA SÃO JOÃO S/A" is Saúde; "Padaria Real" is none.
 */
export function catalogCategoryFor(
  description: string,
): CatalogCategory | null {
  const { key } = normalizeMerchant(description);
  if (!key) return null;
  const padded = ` ${key} `;
  return (
    CATEGORY_CATALOG.find((category) =>
      category.words.some((word) => padded.includes(` ${word} `)),
    ) ?? null
  );
}

/** The catalog category with this key, or null. */
export function catalogCategoryByKey(key: string): CatalogCategory | null {
  return CATEGORY_CATALOG.find((category) => category.key === key) ?? null;
}
