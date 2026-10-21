import { randomUUID } from 'node:crypto';

import type { AccountRepository } from '@/core/contracts/account-repository';
import type { CategoryRepository } from '@/core/contracts/category-repository';
import type { MerchantRuleRepository } from '@/core/contracts/merchant-rule-repository';
import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import { Category } from '@/core/entities/category';
import { ValidationError } from '@/core/errors/validation-error';
import { sameCategoryName } from '@/modules/categories/domain/category-catalog';

import { CategorizeTransactionUseCase } from './categorize-transaction.use-case';

export interface FileUnderNewCategoryInput {
  userId: string;
  name: string;
  color?: string;
  transactionIds: string[];
}

export interface FileUnderNewCategoryResult {
  category: Category;
  /** False when an active category with the same name already existed and was reused. */
  created: boolean;
}

/**
 * Files purchases under a category found or made by name, in one tap on a
 * suggested category (spec 2026-10-19-contas-planejamento-categorias-design.md
 * §5.1). An active category with the same name is reused as it is, its name
 * and color untouched; otherwise a new one is created. Each purchase is then
 * filed and its merchant remembered, through CategorizeTransactionUseCase.
 *
 * The caller runs this in one unit of work (`withTransaction`), so a failure
 * on any transaction id leaves no category behind.
 */
export class FileUnderNewCategoryUseCase {
  private readonly categorize: CategorizeTransactionUseCase;

  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly accountRepository: AccountRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly merchantRuleRepository: MerchantRuleRepository,
  ) {
    this.categorize = new CategorizeTransactionUseCase(
      transactionRepository,
      accountRepository,
      categoryRepository,
      merchantRuleRepository,
    );
  }

  async execute(
    input: FileUnderNewCategoryInput,
  ): Promise<FileUnderNewCategoryResult> {
    const name = input.name.trim();
    if (!name) {
      throw new ValidationError('Category name is required.');
    }

    const existing = (
      await this.categoryRepository.findByUserId(input.userId)
    ).find(
      (category) => !category.archived && sameCategoryName(category.name, name),
    );

    let category = existing;
    if (!category) {
      const now = new Date();
      category = new Category({
        id: randomUUID(),
        userId: input.userId,
        name,
        color: input.color,
        archived: false,
        createdAt: now,
        updatedAt: now,
      });
      await this.categoryRepository.save(category);
    }

    for (const transactionId of input.transactionIds) {
      await this.categorize.execute({
        userId: input.userId,
        transactionId,
        categoryId: category.id,
      });
    }

    return { category, created: !existing };
  }
}
