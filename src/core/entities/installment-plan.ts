import { ValidationError } from '@/core/errors/validation-error';

export type InstallmentPlanId = string;
export type InstallmentPlanKind = 'purchase' | 'loan';

export interface InstallmentPlanProps {
  id: InstallmentPlanId;
  userId: string;
  accountId: string;
  categoryId?: string;
  description: string;
  kind: InstallmentPlanKind;
  /** Purchase: sum of all installments. Loan: the principal borrowed. */
  totalAmount: number;
  installmentCount: number;
  /** Monthly decimal rate (0.02 = 2% a.m.) — loans only. */
  interestRate?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A purchase split into installments, or a loan — both generate a fixed
 * number of future `Transaction` rows (see `modules/installments`). A loan
 * is simply a plan with `kind: 'loan'` and `interestRate` set; the
 * interest/principal split per installment is never stored, only computed
 * on read (see `core/value-objects/loan-amortization.ts`).
 */
export class InstallmentPlan {
  constructor(public readonly props: InstallmentPlanProps) {
    if (!props.description.trim()) {
      throw new ValidationError('Installment plan description is required.');
    }
    if (!Number.isFinite(props.totalAmount) || props.totalAmount <= 0) {
      throw new ValidationError(
        'Installment plan amount must be greater than zero.',
      );
    }
    if (
      !Number.isInteger(props.installmentCount) ||
      props.installmentCount < 2
    ) {
      throw new ValidationError(
        'An installment plan needs at least 2 installments.',
      );
    }
    if (
      props.kind === 'loan' &&
      (props.interestRate === undefined || props.interestRate < 0)
    ) {
      throw new ValidationError(
        'A loan requires a non-negative interest rate.',
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

  get kind() {
    return this.props.kind;
  }

  get totalAmount() {
    return this.props.totalAmount;
  }

  get installmentCount() {
    return this.props.installmentCount;
  }

  get interestRate() {
    return this.props.interestRate;
  }
}
