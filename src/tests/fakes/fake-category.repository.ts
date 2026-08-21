import type { CategoryRepository } from '@/core/contracts/category-repository';
import type { Category } from '@/core/entities/category';

export class FakeCategoryRepository implements CategoryRepository {
  private readonly categories = new Map<string, Category>();

  async findById(id: string): Promise<Category | null> {
    return this.categories.get(id) ?? null;
  }

  async findByUserId(userId: string): Promise<Category[]> {
    return [...this.categories.values()].filter((c) => c.userId === userId);
  }

  async save(category: Category): Promise<void> {
    this.categories.set(category.id, category);
  }

  async delete(id: string): Promise<void> {
    this.categories.delete(id);
  }
}
