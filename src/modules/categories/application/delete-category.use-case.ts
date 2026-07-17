import type { CategoryRepository } from '@/modules/categories/domain/category-repository';
import { ValidationError } from '@/core/errors/validation-error';

export interface DeleteCategoryInput {
  id: string;
}

export class DeleteCategoryUseCase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async execute(input: DeleteCategoryInput): Promise<void> {
    const category = await this.categoryRepository.findById(input.id);

    if (!category) {
      throw new ValidationError('Category not found.');
    }

    await this.categoryRepository.save(category);
  }
}
