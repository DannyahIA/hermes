import type { ViewPreferenceRepository } from '@/core/contracts/view-preference-repository';
import type { ViewPreference } from '@/core/entities/view-preference';

export class FakeViewPreferenceRepository implements ViewPreferenceRepository {
  private readonly preferences = new Map<string, ViewPreference>();

  private key(userId: string, screenKey: string): string {
    return `${userId}:${screenKey}`;
  }

  async findByUserAndScreen(
    userId: string,
    screenKey: string,
  ): Promise<ViewPreference | null> {
    return this.preferences.get(this.key(userId, screenKey)) ?? null;
  }

  async save(preference: ViewPreference): Promise<void> {
    this.preferences.set(
      this.key(preference.userId, preference.screenKey),
      preference,
    );
  }
}
