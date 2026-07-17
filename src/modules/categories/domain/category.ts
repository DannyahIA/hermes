export type CategoryId = string;

export interface CategoryProps {
  id: CategoryId;
  name: string;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Category {
  constructor(public readonly props: CategoryProps) {}

  get id() {
    return this.props.id;
  }

  get name() {
    return this.props.name;
  }

  get color() {
    return this.props.color;
  }
}
