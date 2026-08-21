import { ValidationError } from '@/core/errors/validation-error';

export type UserId = string;

export interface UserProps {
  id: UserId;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * The owner of a set of accounts, categories and budgets. Credential
 * management (password hashing, sessions, OAuth) is entirely delegated to
 * better-auth — this entity only represents the app-level profile that the
 * rest of the domain references by id.
 */
export class User {
  constructor(public readonly props: UserProps) {
    if (!props.name.trim()) {
      throw new ValidationError('User name is required.');
    }
  }

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
