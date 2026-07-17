export type AccountId = string;

export interface AccountProps {
  id: AccountId;
  userId: string;
  name: string;
  type: 'checking' | 'savings' | 'credit';
  balance: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Account {
  constructor(public readonly props: AccountProps) {}

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
}
