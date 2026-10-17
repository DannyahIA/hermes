export interface NormalizedMerchant {
  /** Accent-, case- and number-free; empty when nothing recognizable is left. */
  key: string;
  /** The name as a person would write it. */
  displayName: string;
}

/** Payment processors that prefix the merchant on card statements. */
const PROCESSOR_PREFIX =
  /^(?:pag|pg|mp|mercpago|pagseguro|paypal|sumup|ec)\s*\*\s*/i;
/** A terminal or order id after an asterisk: "PADARIA REAL *123". */
const TRAILING_ID = /\s*\*\s*\S*$/;
/** An installment suffix: "Geladeira (4/10)". */
const INSTALLMENT_SUFFIX = /\s*\(\s*\d+\s*\/\s*\d+\s*\)\s*$/;
const COMPANY_SUFFIXES = new Set([
  'ltda',
  'me',
  'mei',
  'epp',
  'eireli',
  'sa',
  's/a',
  's.a',
  's.a.',
  'cia',
]);
const LOWERCASE_WORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function titleCase(words: string[]): string {
  return words
    .map((word, index) => {
      const lower = word.toLocaleLowerCase('pt-BR');
      if (index > 0 && LOWERCASE_WORDS.has(lower)) return lower;
      return lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1);
    })
    .join(' ');
}

/**
 * The same merchant arrives spelled many ways — "PADARIA REAL LTDA *123"
 * from a card terminal, "Padaria Real" typed by hand. The key is what they
 * share, so a category chosen for one applies to the others; the display
 * name is what to show. A name typed in mixed case is kept as typed
 * ("iFood"); one in all caps or all lowercase is title-cased.
 */
export function normalizeMerchant(raw: string): NormalizedMerchant {
  const cleaned = raw
    .trim()
    .replace(PROCESSOR_PREFIX, '')
    .replace(TRAILING_ID, '')
    .replace(INSTALLMENT_SUFFIX, '');

  const words = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !COMPANY_SUFFIXES.has(word.toLowerCase()));
  // Drop trailing words that are only numbers or punctuation ("LOJA 0123").
  while (words.length > 1 && !/\p{L}/u.test(words.at(-1)!)) words.pop();

  const key = stripAccents(words.join(' '))
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!key) return { key: '', displayName: raw.trim() };

  const joined = words.join(' ');
  const mixedCase =
    joined !== joined.toUpperCase() && joined !== joined.toLowerCase();

  return { key, displayName: mixedCase ? joined : titleCase(words) };
}
