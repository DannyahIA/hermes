import { ValidationError } from '@/core/errors/validation-error';

export interface MerchantRuleProps {
  id: string;
  userId: string;
  /** See normalizeMerchant: what different spellings of one merchant share. */
  merchantKey: string;
  displayName: string;
  categoryId: string;
  /** How many times this category was chosen for this merchant in a row. */
  hits: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * The category a user picks for a merchant, remembered so the next purchase
 * there can be suggested — or, for captured purchases, filed — the same way.
 */
export class MerchantRule {
  constructor(public readonly props: MerchantRuleProps) {
    if (!props.merchantKey.trim()) {
      throw new ValidationError('Merchant rule key is required.');
    }
  }

  get id() {
    return this.props.id;
  }
  get userId() {
    return this.props.userId;
  }
  get merchantKey() {
    return this.props.merchantKey;
  }
  get displayName() {
    return this.props.displayName;
  }
  get categoryId() {
    return this.props.categoryId;
  }
  get hits() {
    return this.props.hits;
  }

  /** Choosing the same category again strengthens the rule; another one replaces it. */
  learn(categoryId: string, now: Date = new Date()): MerchantRule {
    return new MerchantRule({
      ...this.props,
      categoryId,
      hits: categoryId === this.categoryId ? this.hits + 1 : 1,
      updatedAt: now,
    });
  }
}
