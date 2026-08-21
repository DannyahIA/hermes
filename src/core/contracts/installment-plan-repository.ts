import type { InstallmentPlan } from '@/core/entities/installment-plan';

export interface InstallmentPlanRepository {
  findById(id: string): Promise<InstallmentPlan | null>;
  findByUserId(userId: string): Promise<InstallmentPlan[]>;
  save(plan: InstallmentPlan): Promise<void>;
  delete(id: string): Promise<void>;
}
