export type LimitState = 'under' | 'at' | 'over';

/**
 * Where spending stands against a limit: under it, exactly at it, or over.
 * The one place that says what "at" and "over" mean, so the alerts, the pace
 * and the budget screens agree.
 */
export function limitState(spent: number, amount: number): LimitState {
  if (spent > amount) return 'over';
  if (spent === amount) return 'at';
  return 'under';
}
