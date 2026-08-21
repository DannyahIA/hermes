import { describe, expect, it } from 'vitest';

import { SetViewPreferenceUseCase } from '@/modules/preferences/application/set-view-preference.use-case';
import { FakeViewPreferenceRepository } from '@/tests/fakes/fake-view-preference.repository';

describe('SetViewPreferenceUseCase', () => {
  it('creates a new preference', async () => {
    const repository = new FakeViewPreferenceRepository();
    await new SetViewPreferenceUseCase(repository).execute({
      userId: 'user-1',
      screenKey: 'transactions',
      viewMode: 'grouped_by_month',
    });
    const saved = await repository.findByUserAndScreen(
      'user-1',
      'transactions',
    );
    expect(saved?.viewMode).toBe('grouped_by_month');
  });

  it('updates an existing preference for the same user+screen', async () => {
    const repository = new FakeViewPreferenceRepository();
    const useCase = new SetViewPreferenceUseCase(repository);
    await useCase.execute({
      userId: 'user-1',
      screenKey: 'transactions',
      viewMode: 'chronological',
    });
    await useCase.execute({
      userId: 'user-1',
      screenKey: 'transactions',
      viewMode: 'grouped_by_category',
    });

    const saved = await repository.findByUserAndScreen(
      'user-1',
      'transactions',
    );
    expect(saved?.viewMode).toBe('grouped_by_category');
  });

  it('rejects an empty viewMode', async () => {
    const repository = new FakeViewPreferenceRepository();
    await expect(
      new SetViewPreferenceUseCase(repository).execute({
        userId: 'user-1',
        screenKey: 'transactions',
        viewMode: '',
      }),
    ).rejects.toThrow();
  });
});
