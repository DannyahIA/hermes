import type { InstallmentPlanRepository } from '@/core/contracts/installment-plan-repository';
import type { InstallmentPlan } from '@/core/entities/installment-plan';

export class GetInstallmentPlansUseCase {
  constructor(
    private readonly installmentPlanRepository: InstallmentPlanRepository,
  ) {}

  async execute(userId: string): Promise<InstallmentPlan[]> {
    return this.installmentPlanRepository.findByUserId(userId);
  }
}
