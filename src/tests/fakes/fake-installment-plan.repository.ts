import type { InstallmentPlanRepository } from '@/core/contracts/installment-plan-repository';
import type { InstallmentPlan } from '@/core/entities/installment-plan';

export class FakeInstallmentPlanRepository implements InstallmentPlanRepository {
  private readonly plans = new Map<string, InstallmentPlan>();

  async findById(id: string): Promise<InstallmentPlan | null> {
    return this.plans.get(id) ?? null;
  }

  async findByUserId(userId: string): Promise<InstallmentPlan[]> {
    return [...this.plans.values()].filter((p) => p.userId === userId);
  }

  async save(plan: InstallmentPlan): Promise<void> {
    this.plans.set(plan.id, plan);
  }

  async delete(id: string): Promise<void> {
    this.plans.delete(id);
  }
}
