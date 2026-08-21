import { randomUUID } from 'node:crypto';

import type { ViewPreferenceRepository } from '@/core/contracts/view-preference-repository';
import { ViewPreference } from '@/core/entities/view-preference';

export interface SetViewPreferenceInput {
  userId: string;
  screenKey: string;
  viewMode: string;
}

export class SetViewPreferenceUseCase {
  constructor(
    private readonly viewPreferenceRepository: ViewPreferenceRepository,
  ) {}

  async execute(input: SetViewPreferenceInput): Promise<void> {
    const existing = await this.viewPreferenceRepository.findByUserAndScreen(
      input.userId,
      input.screenKey,
    );
    const now = new Date();

    const preference = new ViewPreference({
      id: existing?.id ?? randomUUID(),
      userId: input.userId,
      screenKey: input.screenKey,
      viewMode: input.viewMode,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });

    await this.viewPreferenceRepository.save(preference);
  }
}
