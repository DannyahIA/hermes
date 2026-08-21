import type { CategoryRepository } from '@/core/contracts/category-repository';
import { Category } from '@/core/entities/category';

export interface CreateCategoryInput {
  id: string;
  userId: string;
  name: string;
  description?: string;
  color?: string;
}

export class CreateCategoryUseCase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async execute(input: CreateCategoryInput): Promise<Category> {
    const category = new Category({
      ...input,
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await this.categoryRepository.save(category);

    return category;
  }
}
