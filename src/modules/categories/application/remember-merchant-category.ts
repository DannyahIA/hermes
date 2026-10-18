import { randomUUID } from 'node:crypto';

import type { MerchantRuleRepository } from '@/core/contracts/merchant-rule-repository';
import { MerchantRule } from '@/core/entities/merchant-rule';
import { normalizeMerchant } from '@/modules/capture/domain/normalize-merchant';

interface RememberInput {
  userId: string;
  /** The transaction's description; its merchant is what gets remembered. */
  description: string;
  categoryId: string;
  now?: Date;
}

/**
 * Remembers the category chosen for a merchant (merchant_rules), so the
 * next entry there is suggested — or filed — the same way. Choosing the
 * same category again strengthens the rule; another one replaces it.
 * Null when the description names no merchant ("123").
 */
export async function rememberMerchantCategory(
  repository: MerchantRuleRepository,
  { userId, description, categoryId, now = new Date() }: RememberInput,
): Promise<MerchantRule | null> {
  const merchant = normalizeMerchant(description);
  if (!merchant.key) return null;

  const existing = await repository.findByKey(userId, merchant.key);
  const rule =
    existing?.learn(categoryId, now) ??
    new MerchantRule({
      id: randomUUID(),
      userId,
      merchantKey: merchant.key,
      displayName: merchant.displayName,
      categoryId,
      hits: 1,
      createdAt: now,
      updatedAt: now,
    });
  await repository.save(rule);
  return rule;
}
