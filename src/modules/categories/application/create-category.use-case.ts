import type { CategoryRepository } from '@/modules/categories/domain/category-repository';
import { Category } from '@/modules/categories/domain/category';
import { ValidationError } from '@/core/errors/validation-error';

export interface CreateCategoryInput {
  id: string;
  name: string;
  color?: string;
}

export class CreateCategoryUseCase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async execute(input: CreateCategoryInput): Promise<Category> {
    if (!input.name.trim()) {
      throw new ValidationError('Category name is required.');
    }

    const category = new Category({
      ...input,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await this.categoryRepository.save(category);

    return category;
  }
}
