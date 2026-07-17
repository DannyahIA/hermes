import type { Category } from '@/modules/categories/domain/category';

export interface CategoryRepository {
  findById(id: string): Promise<Category | null>;
  save(category: Category): Promise<void>;
}
