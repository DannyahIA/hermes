import type { MerchantRule } from '@/core/entities/merchant-rule';

export interface MerchantRuleRepository {
  findById(id: string): Promise<MerchantRule | null>;
  findByUserId(userId: string): Promise<MerchantRule[]>;
  findByKey(userId: string, merchantKey: string): Promise<MerchantRule | null>;
  save(rule: MerchantRule): Promise<void>;
  delete(id: string): Promise<void>;
}
