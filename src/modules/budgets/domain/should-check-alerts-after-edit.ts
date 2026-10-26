export interface EditedPurchase {
  amount: number;
  categoryId?: string;
  occurredAt: Date;
}

/**
 * Whether editing a purchase can say something new about a budget: only when
 * it now weighs more, sits in another category, or moves to another day.
 * Fixing a description must not repeat an over-the-limit line.
 */
export function shouldCheckAlertsAfterEdit(
  before: EditedPurchase,
  after: EditedPurchase,
): boolean {
  return (
    after.amount > before.amount ||
    after.categoryId !== before.categoryId ||
    after.occurredAt.getTime() !== before.occurredAt.getTime()
  );
}
