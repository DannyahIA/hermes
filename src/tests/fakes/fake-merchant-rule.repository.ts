import type { MerchantRuleRepository } from '@/core/contracts/merchant-rule-repository';
import type { MerchantRule } from '@/core/entities/merchant-rule';

export class FakeMerchantRuleRepository implements MerchantRuleRepository {
  private readonly rules = new Map<string, MerchantRule>();

  private key(userId: string, merchantKey: string): string {
    return `${userId}:${merchantKey}`;
  }

  async findById(id: string): Promise<MerchantRule | null> {
    return [...this.rules.values()].find((rule) => rule.id === id) ?? null;
  }

  async findByUserId(userId: string): Promise<MerchantRule[]> {
    return [...this.rules.values()].filter((rule) => rule.userId === userId);
  }

  async findByKey(
    userId: string,
    merchantKey: string,
  ): Promise<MerchantRule | null> {
    return this.rules.get(this.key(userId, merchantKey)) ?? null;
  }

  async save(rule: MerchantRule): Promise<void> {
    this.rules.set(this.key(rule.userId, rule.merchantKey), rule);
  }

  async delete(id: string): Promise<void> {
    for (const [key, rule] of this.rules) {
      if (rule.id === id) this.rules.delete(key);
    }
  }
}
