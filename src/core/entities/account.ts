import { DomainError } from '@/core/errors/domain-error';
import { ValidationError } from '@/core/errors/validation-error';

export type AccountId = string;
export type AccountKind = 'checking' | 'savings' | 'credit';

export interface AccountProps {
  id: AccountId;
  userId: string;
  name: string;
  type: AccountKind;
  balance: number;
  currency: string;
  archived: boolean;
  hidden: boolean;
  /** Day of the month a credit card's statement closes (1–28). Only meaningful for `type: 'credit'`. */
  closingDay?: number;
  /** Day of the month a credit card's bill is due (1–28). Only meaningful for `type: 'credit'`. */
  dueDay?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A place where money exists (checking, savings, wallet, credit card...).
 * Per domain.md's Single Source of Truth rule, `balance` is a consequence of
 * transactions — it is never edited directly by a user. The only supported
 * mutation path here is `withBalanceDelta`, invoked exclusively by the
 * transaction use-cases inside a unit-of-work.
 */
export class Account {
  constructor(public readonly props: AccountProps) {
    if (!Number.isFinite(props.balance)) {
      throw new DomainError('An account can never hold an invalid balance.');
    }
    if (!props.name.trim()) {
      throw new ValidationError('Account name is required.');
    }
  }

  get id() {
    return this.props.id;
  }

  get userId() {
    return this.props.userId;
  }

  get name() {
    return this.props.name;
  }

  get type() {
    return this.props.type;
  }

  get balance() {
    return this.props.balance;
  }

  get currency() {
    return this.props.currency;
  }

  get archived() {
    return this.props.archived;
  }

  get hidden() {
    return this.props.hidden;
  }

  get closingDay() {
    return this.props.closingDay;
  }

  get dueDay() {
    return this.props.dueDay;
  }

  /**
   * The signed effect a transaction of the given type has on this account's
   * balance. For cash accounts (checking/savings) an expense reduces what
   * you have. For a credit card, balance represents what you *owe* — an
   * expense there accrues debt (increases balance) and an income (e.g. a
   * refund) reduces it. Centralized here so every transaction use-case
   * applies the same rule instead of re-deriving it.
   */
  deltaFor(type: 'income' | 'expense', amount: number): number {
    const isCredit = this.props.type === 'credit';
    if (type === 'income') {
      return isCredit ? -amount : amount;
    }
    return isCredit ? amount : -amount;
  }

  /**
   * The next date this credit card's bill is due, given a reference date.
   * A pure calculation — Hermes never persists a "bill" entity; the cycle
   * is derived from `closingDay`/`dueDay` whenever it's needed.
   */
  nextDueDate(reference: Date): Date | null {
    if (this.props.type !== 'credit' || !this.props.dueDay) {
      return null;
    }

    const dueDay = this.props.dueDay;
    const candidate = new Date(
      reference.getFullYear(),
      reference.getMonth(),
      dueDay,
    );

    if (candidate < reference) {
      candidate.setMonth(candidate.getMonth() + 1);
    }

    return candidate;
  }

  withBalanceDelta(delta: number): Account {
    if (this.props.archived) {
      throw new DomainError(
        'Cannot post a transaction to an archived account.',
      );
    }

    return new Account({
      ...this.props,
      balance: this.props.balance + delta,
      updatedAt: new Date(),
    });
  }

  /**
   * Updates editable details. `balance` is intentionally not a parameter
   * here — see the class doc comment.
   */
  update(changes: {
    name?: string;
    type?: AccountKind;
    currency?: string;
    closingDay?: number;
    dueDay?: number;
  }): Account {
    // Constructor validation below enforces the name is non-blank.
    return new Account({
      ...this.props,
      name: changes.name?.trim() ?? this.props.name,
      type: changes.type ?? this.props.type,
      currency: changes.currency ?? this.props.currency,
      closingDay: changes.closingDay ?? this.props.closingDay,
      dueDay: changes.dueDay ?? this.props.dueDay,
      updatedAt: new Date(),
    });
  }

  archive(): Account {
    return new Account({
      ...this.props,
      archived: true,
      updatedAt: new Date(),
    });
  }

  unarchive(): Account {
    return new Account({
      ...this.props,
      archived: false,
      updatedAt: new Date(),
    });
  }

  setHidden(hidden: boolean): Account {
    return new Account({ ...this.props, hidden, updatedAt: new Date() });
  }
}
