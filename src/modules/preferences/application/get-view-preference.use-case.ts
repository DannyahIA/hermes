import type { ViewPreferenceRepository } from '@/core/contracts/view-preference-repository';

export class GetViewPreferenceUseCase {
  constructor(
    private readonly viewPreferenceRepository: ViewPreferenceRepository,
  ) {}

  async execute(
    userId: string,
    screenKey: string,
    defaultViewMode: string,
  ): Promise<string> {
    const preference = await this.viewPreferenceRepository.findByUserAndScreen(
      userId,
      screenKey,
    );
    return preference?.viewMode ?? defaultViewMode;
  }
}
