import { ValidationError } from '@/core/errors/validation-error';
import { DateRange } from '@/core/value-objects/date-range';

export type BudgetId = string;

export interface BudgetProps {
  id: BudgetId;
  userId: string;
  categoryId: string;
  amount: number;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A spending limit for a category over a period. Budgets never persist
 * "amount spent" — that is always computed from transactions at read time
 * (see `modules/budgets` progress calculation).
 */
export class Budget {
  public readonly period: DateRange;

  constructor(public readonly props: BudgetProps) {
    if (!Number.isFinite(props.amount) || props.amount <= 0) {
      throw new ValidationError('Budget amount must be greater than zero.');
    }
    // Validates periodStart <= periodEnd as a side effect.
    this.period = new DateRange(props.periodStart, props.periodEnd);
  }

  get id() {
    return this.props.id;
  }

  get userId() {
    return this.props.userId;
  }

  get categoryId() {
    return this.props.categoryId;
  }

  get amount() {
    return this.props.amount;
  }

  get currency() {
    return this.props.currency;
  }

  get periodStart() {
    return this.props.periodStart;
  }

  get periodEnd() {
    return this.props.periodEnd;
  }
}
