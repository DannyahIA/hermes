import { eq } from 'drizzle-orm';

import type { InstallmentPlanRepository } from '@/core/contracts/installment-plan-repository';
import {
  InstallmentPlan,
  type InstallmentPlanKind,
} from '@/core/entities/installment-plan';
import type { Executor } from '@/infra/database/client';
import { db } from '@/infra/database/client';
import { installmentPlans } from '@/infra/database/schema';

type InstallmentPlanRow = typeof installmentPlans.$inferSelect;

function toDomain(row: InstallmentPlanRow): InstallmentPlan {
  return new InstallmentPlan({
    id: row.id,
    userId: row.userId,
    accountId: row.accountId,
    categoryId: row.categoryId ?? undefined,
    description: row.description,
    kind: row.kind as InstallmentPlanKind,
    totalAmount: Number(row.totalAmount),
    installmentCount: row.installmentCount,
    interestRate: row.interestRate ? Number(row.interestRate) : undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export class DrizzleInstallmentPlanRepository implements InstallmentPlanRepository {
  constructor(private readonly executor: Executor = db) {}

  async findById(id: string): Promise<InstallmentPlan | null> {
    const [row] = await this.executor
      .select()
      .from(installmentPlans)
      .where(eq(installmentPlans.id, id))
      .limit(1);

    return row ? toDomain(row) : null;
  }

  async findByUserId(userId: string): Promise<InstallmentPlan[]> {
    const rows = await this.executor
      .select()
      .from(installmentPlans)
      .where(eq(installmentPlans.userId, userId));

    return rows.map(toDomain);
  }

  async save(plan: InstallmentPlan): Promise<void> {
    const values = {
      id: plan.id,
      userId: plan.userId,
      accountId: plan.accountId,
      categoryId: plan.categoryId ?? null,
      description: plan.description,
      kind: plan.kind,
      totalAmount: plan.totalAmount.toFixed(2),
      installmentCount: plan.installmentCount,
      interestRate: plan.interestRate?.toFixed(6) ?? null,
      updatedAt: plan.props.updatedAt,
    };

    await this.executor
      .insert(installmentPlans)
      .values({ ...values, createdAt: plan.props.createdAt })
      .onConflictDoUpdate({ target: installmentPlans.id, set: values });
  }

  async delete(id: string): Promise<void> {
    await this.executor
      .delete(installmentPlans)
      .where(eq(installmentPlans.id, id));
  }
}
