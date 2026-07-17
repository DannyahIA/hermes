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

export class Budget {
  constructor(public readonly props: BudgetProps) {}

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
}
