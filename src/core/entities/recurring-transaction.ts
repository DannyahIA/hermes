import { ValidationError } from '@/core/errors/validation-error';

export type RecurringTransactionId = string;
export type RecurringTransactionKind = 'income' | 'expense';
export type DayRuleKind =
  'fixed_day' | 'first_business_day' | 'last_business_day';

export interface RecurringTransactionProps {
  id: RecurringTransactionId;
  userId: string;
  accountId: string;
  categoryId?: string;
  description: string;
  amount: number;
  type: RecurringTransactionKind;
  dayRuleKind: DayRuleKind;
  /** Only meaningful when dayRuleKind === 'fixed_day' (1–31). */
  dayRuleDay?: number;
  startDate: Date;
  endDate?: Date;
  /** The last month this rule has already materialized a transaction for. */
  lastGeneratedThrough?: Date;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A repeating income or expense — "salário no primeiro dia útil", "internet
 * todo dia 8". Doesn't hold the recurrence math itself (see
 * `core/value-objects/recurrence.ts`); this entity is just the validated
 * record of the rule.
 */
export class RecurringTransaction {
  constructor(public readonly props: RecurringTransactionProps) {
    if (!props.description.trim()) {
      throw new ValidationError(
        'Recurring transaction description is required.',
      );
    }
    if (!Number.isFinite(props.amount) || props.amount <= 0) {
      throw new ValidationError(
        'Recurring transaction amount must be greater than zero.',
      );
    }
    if (props.dayRuleKind === 'fixed_day') {
      if (
        props.dayRuleDay === undefined ||
        !Number.isInteger(props.dayRuleDay) ||
        props.dayRuleDay < 1 ||
        props.dayRuleDay > 31
      ) {
        throw new ValidationError(
          'A fixed-day rule needs a day between 1 and 31.',
        );
      }
    }
    if (props.endDate && props.endDate < props.startDate) {
      throw new ValidationError(
        'The end date cannot be before the start date.',
      );
    }
  }

  get id() {
    return this.props.id;
  }

  get userId() {
    return this.props.userId;
  }

  get accountId() {
    return this.props.accountId;
  }

  get categoryId() {
    return this.props.categoryId;
  }

  get description() {
    return this.props.description;
  }

  get amount() {
    return this.props.amount;
  }

  get type() {
    return this.props.type;
  }

  get dayRuleKind() {
    return this.props.dayRuleKind;
  }

  get dayRuleDay() {
    return this.props.dayRuleDay;
  }

  get startDate() {
    return this.props.startDate;
  }

  get endDate() {
    return this.props.endDate;
  }

  get lastGeneratedThrough() {
    return this.props.lastGeneratedThrough;
  }

  get active() {
    return this.props.active;
  }

  withLastGeneratedThrough(date: Date): RecurringTransaction {
    return new RecurringTransaction({
      ...this.props,
      lastGeneratedThrough: date,
      updatedAt: new Date(),
    });
  }

  update(changes: {
    description?: string;
    amount?: number;
    categoryId?: string;
    dayRuleKind?: DayRuleKind;
    dayRuleDay?: number;
    endDate?: Date | null;
    active?: boolean;
  }): RecurringTransaction {
    return new RecurringTransaction({
      ...this.props,
      description: changes.description?.trim() ?? this.props.description,
      amount: changes.amount ?? this.props.amount,
      categoryId: changes.categoryId ?? this.props.categoryId,
      dayRuleKind: changes.dayRuleKind ?? this.props.dayRuleKind,
      dayRuleDay: changes.dayRuleDay ?? this.props.dayRuleDay,
      endDate:
        changes.endDate === null
          ? undefined
          : (changes.endDate ?? this.props.endDate),
      active: changes.active ?? this.props.active,
      updatedAt: new Date(),
    });
  }
}
