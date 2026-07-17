export type UserId = string;

export interface UserProps {
  id: UserId;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export class User {
  constructor(public readonly props: UserProps) {}

  get id() {
    return this.props.id;
  }

  get name() {
    return this.props.name;
  }

  get email() {
    return this.props.email;
  }

  get createdAt() {
    return this.props.createdAt;
  }

  get updatedAt() {
    return this.props.updatedAt;
  }
}
