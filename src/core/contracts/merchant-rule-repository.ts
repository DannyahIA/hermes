import type { MerchantRule } from '@/core/entities/merchant-rule';

export interface MerchantRuleRepository {
  findByUserId(userId: string): Promise<MerchantRule[]>;
  findByKey(userId: string, merchantKey: string): Promise<MerchantRule | null>;
  save(rule: MerchantRule): Promise<void>;
}
