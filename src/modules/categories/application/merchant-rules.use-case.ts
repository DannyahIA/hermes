import type { CategoryRepository } from '@/core/contracts/category-repository';
import type { MerchantRuleRepository } from '@/core/contracts/merchant-rule-repository';
import type { MerchantRule } from '@/core/entities/merchant-rule';
import { DomainError } from '@/core/errors/domain-error';
import { NotFoundError } from '@/core/errors/not-found-error';

async function ownedRule(
  rules: MerchantRuleRepository,
  userId: string,
  ruleId: string,
): Promise<MerchantRule> {
  const rule = await rules.findById(ruleId);
  if (!rule || rule.userId !== userId) {
    throw new NotFoundError('MerchantRule', ruleId);
  }
  return rule;
}

/**
 * Files a remembered merchant under another category (Configurações ›
 * Estabelecimentos, spec 2026-10-17-telegram-apple-pay-design.md §6): its
 * next captured payment lands there, and the choice starts counting anew.
 */
export class ChangeMerchantRuleCategoryUseCase {
  constructor(
    private readonly rules: MerchantRuleRepository,
    private readonly categories: CategoryRepository,
  ) {}

  async execute(input: {
    userId: string;
    ruleId: string;
    categoryId: string;
    now?: Date;
  }): Promise<MerchantRule> {
    const rule = await ownedRule(this.rules, input.userId, input.ruleId);
    const category = await this.categories.findById(input.categoryId);
    if (!category || category.userId !== input.userId) {
      throw new NotFoundError('Category', input.categoryId);
    }
    if (category.archived) {
      throw new DomainError(
        'An archived category cannot receive new transactions.',
        'CATEGORY_ARCHIVED',
      );
    }
    const changed = rule.learn(category.id, input.now ?? new Date());
    await this.rules.save(changed);
    return changed;
  }
}

/** Forgets a merchant: its next payment asks for a category again. */
export class ForgetMerchantRuleUseCase {
  constructor(private readonly rules: MerchantRuleRepository) {}

  async execute(input: { userId: string; ruleId: string }): Promise<void> {
    const rule = await ownedRule(this.rules, input.userId, input.ruleId);
    await this.rules.delete(rule.id);
  }
}
