import { ValidationError } from '@/core/errors/validation-error';

export type CategoryId = string;

export interface CategoryProps {
  id: CategoryId;
  userId: string;
  name: string;
  description?: string;
  color?: string;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A classification a user assigns to transactions (e.g. "Alimentação").
 * Categories belong to a user — they are never shared/global. An archived
 * category can no longer receive new transactions.
 */
export class Category {
  constructor(public readonly props: CategoryProps) {
    if (!props.name.trim()) {
      throw new ValidationError('Category name is required.');
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

  get description() {
    return this.props.description;
  }

  get color() {
    return this.props.color;
  }

  get archived() {
    return this.props.archived;
  }

  archive(): Category {
    return new Category({
      ...this.props,
      archived: true,
      updatedAt: new Date(),
    });
  }

  unarchive(): Category {
    return new Category({
      ...this.props,
      archived: false,
      updatedAt: new Date(),
    });
  }
}
