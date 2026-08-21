import { describe, expect, it } from 'vitest';

import { Category } from '@/core/entities/category';
import { DomainError } from '@/core/errors/domain-error';
import { FakeCategoryRepository } from '@/tests/fakes/fake-category.repository';

import { DeleteCategoryUseCase } from './delete-category.use-case';

const USER_ID = 'user-1';

function seed(repository: FakeCategoryRepository) {
  return repository.save(
    new Category({
      id: 'cat-1',
      userId: USER_ID,
      name: 'Lazer',
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  );
}

describe('DeleteCategoryUseCase', () => {
  it('actually deletes the category (regression: used to call save() instead)', async () => {
    const repository = new FakeCategoryRepository();
    await seed(repository);
    const useCase = new DeleteCategoryUseCase(repository, async () => false);

    await useCase.execute({ id: 'cat-1', userId: USER_ID });

    expect(await repository.findById('cat-1')).toBeNull();
  });

  it('blocks deletion when transactions reference the category', async () => {
    const repository = new FakeCategoryRepository();
    await seed(repository);
    const useCase = new DeleteCategoryUseCase(repository, async () => true);

    await expect(
      useCase.execute({ id: 'cat-1', userId: USER_ID }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});
