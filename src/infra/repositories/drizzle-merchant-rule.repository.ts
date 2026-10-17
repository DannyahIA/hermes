import { and, eq } from 'drizzle-orm';

import type { MerchantRuleRepository } from '@/core/contracts/merchant-rule-repository';
import { MerchantRule } from '@/core/entities/merchant-rule';
import type { Executor } from '@/infra/database/client';
import { db } from '@/infra/database/client';
import { merchantRules } from '@/infra/database/schema';

type MerchantRuleRow = typeof merchantRules.$inferSelect;

function toDomain(row: MerchantRuleRow): MerchantRule {
  return new MerchantRule({
    id: row.id,
    userId: row.userId,
    merchantKey: row.merchantKey,
    displayName: row.displayName,
    categoryId: row.categoryId,
    hits: row.hits,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export class DrizzleMerchantRuleRepository implements MerchantRuleRepository {
  constructor(private readonly executor: Executor = db) {}

  async findByUserId(userId: string): Promise<MerchantRule[]> {
    const rows = await this.executor
      .select()
      .from(merchantRules)
      .where(eq(merchantRules.userId, userId));

    return rows.map(toDomain);
  }

  async findByKey(
    userId: string,
    merchantKey: string,
  ): Promise<MerchantRule | null> {
    const [row] = await this.executor
      .select()
      .from(merchantRules)
      .where(
        and(
          eq(merchantRules.userId, userId),
          eq(merchantRules.merchantKey, merchantKey),
        ),
      )
      .limit(1);

    return row ? toDomain(row) : null;
  }

  async save(rule: MerchantRule): Promise<void> {
    const values = {
      userId: rule.userId,
      merchantKey: rule.merchantKey,
      displayName: rule.displayName,
      categoryId: rule.categoryId,
      hits: rule.hits,
      updatedAt: rule.props.updatedAt,
    };

    await this.executor
      .insert(merchantRules)
      .values({ ...values, id: rule.id, createdAt: rule.props.createdAt })
      .onConflictDoUpdate({
        target: [merchantRules.userId, merchantRules.merchantKey],
        set: values,
      });
  }
}
