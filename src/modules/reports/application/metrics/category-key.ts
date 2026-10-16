export const UNCATEGORIZED_KEY = 'uncategorized';

export function resolveCategoryName(
  categoryId: string,
  categoriesById: Map<string, { name: string }>,
): string {
  if (categoryId === UNCATEGORIZED_KEY) return 'Sem categoria';
  return categoriesById.get(categoryId)?.name ?? 'Categoria removida';
}
