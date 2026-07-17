export type TransactionId = string;

export interface TransactionProps {
  id: TransactionId;
  accountId: string;
  categoryId?: string;
  description: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class Transaction {
  constructor(public readonly props: TransactionProps) {}

  get id() {
    return this.props.id;
  }

  get accountId() {
    return this.props.accountId;
  }

  get amount() {
    return this.props.amount;
  }

  get type() {
    return this.props.type;
  }

  get occurredAt() {
    return this.props.occurredAt;
  }
}
