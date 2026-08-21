import type { CategoryRepository } from '@/core/contracts/category-repository';
import type { Category } from '@/core/entities/category';
import { NotFoundError } from '@/core/errors/not-found-error';

export interface ArchiveCategoryInput {
  id: string;
  userId: string;
  archived: boolean;
}

export class ArchiveCategoryUseCase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async execute(input: ArchiveCategoryInput): Promise<Category> {
    const category = await this.categoryRepository.findById(input.id);

    if (!category || category.userId !== input.userId) {
      throw new NotFoundError('Category', input.id);
    }

    const updated = input.archived ? category.archive() : category.unarchive();
    await this.categoryRepository.save(updated);

    return updated;
  }
}
