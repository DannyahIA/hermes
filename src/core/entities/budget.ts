import { ValidationError } from '@/core/errors/validation-error';
import { DateRange } from '@/core/value-objects/date-range';

export type BudgetId = string;

/**
 * `monthly` starts over every month from `periodStart` on; `fixed` runs
 * between two dates (the "por prazo" budget).
 */
export type BudgetKind = 'monthly' | 'fixed';

/** A monthly budget's limit, in force from `startsOn` (a month's first day). */
export interface BudgetLimit {
  startsOn: Date;
  amount: number;
}

export interface BudgetProps {
  id: BudgetId;
  userId: string;
  categoryId: string;
  /** The limit in force now. For a monthly budget, the latest one. */
  amount: number;
  currency: string;
  kind: BudgetKind;
  /** Monthly only: earlier limits, so past months keep the amount they had. */
  limits: BudgetLimit[];
  periodStart: Date;
  /** Null only for a `monthly` budget, which has no end. */
  periodEnd: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A spending limit for a category, either over a fixed period or month after
 * month. Budgets never persist "amount spent" — that is always computed from
 * transactions at read time (see `modules/budgets` progress calculation).
 */
export class Budget {
  /**
   * The fixed budget's own dates; for a monthly one, its first month (kept so
   * callers that predate monthly budgets keep working — use `periodFor`).
   */
  public readonly period: DateRange;

  constructor(public readonly props: BudgetProps) {
    if (!Number.isFinite(props.amount) || props.amount <= 0) {
      throw new ValidationError('Budget amount must be greater than zero.');
    }
    if (props.limits.some((l) => !Number.isFinite(l.amount) || l.amount <= 0)) {
      throw new ValidationError('Budget limits must be greater than zero.');
    }
    if (props.kind === 'fixed') {
      if (!props.periodEnd) {
        throw new ValidationError('A fixed budget needs an end date.');
      }
      // Validates periodStart <= periodEnd as a side effect.
      this.period = new DateRange(props.periodStart, props.periodEnd);
    } else {
      this.period = DateRange.monthOf(props.periodStart);
    }
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

  get kind() {
    return this.props.kind;
  }

  get periodStart() {
    return this.props.periodStart;
  }

  /** The end of `period`: the fixed end date, or the end of a monthly one's first month. */
  get periodEnd() {
    return this.period.end;
  }

  /** Whether the budget is in force on `date`. */
  runsOn(date: Date): boolean {
    if (this.kind === 'fixed') return this.period.contains(date);
    return date >= this.period.start;
  }

  /**
   * The period `date` falls in: a fixed budget's own dates, or the month for a
   * monthly one (its first month for a date before it started).
   */
  periodFor(date: Date): DateRange {
    if (this.kind === 'fixed') return this.period;
    return date < this.period.start ? this.period : DateRange.monthOf(date);
  }

  /** The limit in force on `date`. */
  amountFor(date: Date): number {
    let amount = this.props.amount;
    let latest: Date | null = null;
    for (const limit of this.props.limits) {
      if (limit.startsOn <= date && (!latest || limit.startsOn >= latest)) {
        amount = limit.amount;
        latest = limit.startsOn;
      }
    }
    return amount;
  }

  /**
   * A fixed budget's limit is replaced outright. A monthly one keeps the old
   * limit for the months before `from`'s month and uses the new one from then on.
   */
  withLimit(amount: number, from: Date): Budget {
    const updatedAt = new Date();
    if (this.kind === 'fixed') {
      return new Budget({ ...this.props, amount, updatedAt });
    }
    const startsOn = DateRange.monthOf(from).start;
    const known =
      this.props.limits.length > 0
        ? this.props.limits
        : [{ startsOn: this.props.periodStart, amount: this.props.amount }];
    const limits = [
      ...known.filter((l) => l.startsOn.getTime() !== startsOn.getTime()),
      { startsOn, amount },
    ].sort((a, b) => a.startsOn.getTime() - b.startsOn.getTime());
    return new Budget({
      ...this.props,
      amount: limits[limits.length - 1].amount,
      limits,
      updatedAt,
    });
  }
}
