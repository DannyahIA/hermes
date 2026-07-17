import type { CategoryRepository } from '@/modules/categories/domain/category-repository';
import { Category } from '@/modules/categories/domain/category';
import { ValidationError } from '@/core/errors/validation-error';

export interface UpdateCategoryInput {
  id: string;
  name?: string;
  color?: string;
}

export class UpdateCategoryUseCase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async execute(input: UpdateCategoryInput): Promise<Category> {
    const category = await this.categoryRepository.findById(input.id);

    if (!category) {
      throw new ValidationError('Category not found.');
    }

    const updatedCategory = new Category({
      ...category.props,
      ...input,
      updatedAt: new Date(),
    });

    await this.categoryRepository.save(updatedCategory);

    return updatedCategory;
  }
}
