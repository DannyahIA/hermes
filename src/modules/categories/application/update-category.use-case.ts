import type { CategoryRepository } from '@/core/contracts/category-repository';
import { Category } from '@/core/entities/category';
import { NotFoundError } from '@/core/errors/not-found-error';

/**
 * `userId` and `archived` are deliberately not editable here — ownership
 * never changes, and archiving has its own dedicated use-case
 * (`ArchiveCategoryUseCase`), mirroring the accounts module.
 */
export interface UpdateCategoryInput {
  id: string;
  userId: string;
  name?: string;
  description?: string;
  color?: string;
}

export class UpdateCategoryUseCase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async execute(input: UpdateCategoryInput): Promise<Category> {
    const category = await this.categoryRepository.findById(input.id);

    if (!category || category.userId !== input.userId) {
      throw new NotFoundError('Category', input.id);
    }

    const updated = new Category({
      ...category.props,
      name: input.name ?? category.props.name,
      description: input.description ?? category.props.description,
      color: input.color ?? category.props.color,
      updatedAt: new Date(),
    });

    await this.categoryRepository.save(updated);

    return updated;
  }
}
