import type { CategoryRepository } from '@/core/contracts/category-repository';
import type { Category } from '@/core/entities/category';

export class GetCategoriesUseCase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async execute(userId: string): Promise<Category[]> {
    return this.categoryRepository.findByUserId(userId);
  }
}
