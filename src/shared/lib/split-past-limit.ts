/**
 * Splits a categorical series so at most `limit` identities are ever shown
 * individually — the (limit)th slot onward folds into a single "Outros"
 * bucket instead of generating or cycling a new hue. A generated 7th hue is
 * indistinguishable from an existing one under colorblindness, so the chart
 * palette has a hard slot count and this is how series longer than it are
 * handled.
 */
export function splitPastLimit<T>(
  items: T[],
  limit: number,
): { head: T[]; tail: T[] } {
  if (items.length <= limit) return { head: items, tail: [] };
  return { head: items.slice(0, limit - 1), tail: items.slice(limit - 1) };
}
