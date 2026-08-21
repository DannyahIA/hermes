import type { CategoryRepository } from '@/core/contracts/category-repository';
import { DomainError } from '@/core/errors/domain-error';
import { NotFoundError } from '@/core/errors/not-found-error';

export interface DeleteCategoryInput {
  id: string;
  userId: string;
}

export class DeleteCategoryUseCase {
  constructor(
    private readonly categoryRepository: CategoryRepository,
    private readonly hasTransactions: (categoryId: string) => Promise<boolean>,
  ) {}

  async execute(input: DeleteCategoryInput): Promise<void> {
    const category = await this.categoryRepository.findById(input.id);

    if (!category || category.userId !== input.userId) {
      throw new NotFoundError('Category', input.id);
    }

    if (await this.hasTransactions(input.id)) {
      throw new DomainError(
        'This category has transactions and cannot be deleted. Archive it instead.',
        'CATEGORY_HAS_TRANSACTIONS',
      );
    }

    await this.categoryRepository.delete(input.id);
  }
}
