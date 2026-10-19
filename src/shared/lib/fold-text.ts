/**
 * Text the way a search compares it: lowercase and without accents, so
 * "cafe" finds "Café". The transaction repository folds the description
 * the same way in SQL (see drizzle-transaction.repository.ts).
 */
export function foldText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR');
}
