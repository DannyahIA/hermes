import { describe, expect, it } from 'vitest';

import { ViewPreference } from '@/core/entities/view-preference';
import { GetViewPreferenceUseCase } from '@/modules/preferences/application/get-view-preference.use-case';
import { FakeViewPreferenceRepository } from '@/tests/fakes/fake-view-preference.repository';

describe('GetViewPreferenceUseCase', () => {
  it('returns the default when no preference has been saved', async () => {
    const repository = new FakeViewPreferenceRepository();
    const result = await new GetViewPreferenceUseCase(repository).execute(
      'user-1',
      'transactions',
      'chronological',
    );
    expect(result).toBe('chronological');
  });

  it('returns the saved preference when one exists', async () => {
    const repository = new FakeViewPreferenceRepository();
    await repository.save(
      new ViewPreference({
        id: 'pref-1',
        userId: 'user-1',
        screenKey: 'transactions',
        viewMode: 'grouped_by_category',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    const result = await new GetViewPreferenceUseCase(repository).execute(
      'user-1',
      'transactions',
      'chronological',
    );
    expect(result).toBe('grouped_by_category');
  });
});
