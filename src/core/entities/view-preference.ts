import { ValidationError } from '@/core/errors/validation-error';

export interface ViewPreferenceProps {
  id: string;
  userId: string;
  screenKey: string;
  viewMode: string;
  createdAt: Date;
  updatedAt: Date;
}

/** A user's saved display preference for one screen. `screenKey`/`viewMode`
 * are free-form strings validated by the calling use-case (which knows the
 * valid values for its own screen) — this entity only enforces they're
 * non-empty, keeping it reusable across screens with different vocabularies. */
export class ViewPreference {
  constructor(public readonly props: ViewPreferenceProps) {
    if (!props.screenKey.trim()) {
      throw new ValidationError('View preference screenKey is required.');
    }
    if (!props.viewMode.trim()) {
      throw new ValidationError('View preference viewMode is required.');
    }
  }

  get id() {
    return this.props.id;
  }
  get userId() {
    return this.props.userId;
  }
  get screenKey() {
    return this.props.screenKey;
  }
  get viewMode() {
    return this.props.viewMode;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }
}
