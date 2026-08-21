import type { CategoryRepository } from '@/core/contracts/category-repository';
import type { Category } from '@/core/entities/category';
import { NotFoundError } from '@/core/errors/not-found-error';

export interface GetCategoryInput {
  id: string;
  userId: string;
}

export class GetCategoryUseCase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async execute(input: GetCategoryInput): Promise<Category> {
    const category = await this.categoryRepository.findById(input.id);

    if (!category || category.userId !== input.userId) {
      throw new NotFoundError('Category', input.id);
    }

    return category;
  }
}
