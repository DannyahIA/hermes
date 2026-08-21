import type { ViewPreference } from '@/core/entities/view-preference';

export interface ViewPreferenceRepository {
  findByUserAndScreen(
    userId: string,
    screenKey: string,
  ): Promise<ViewPreference | null>;
  save(preference: ViewPreference): Promise<void>;
}
