import { eq } from 'drizzle-orm';

import type { CategoryRepository } from '@/core/contracts/category-repository';
import { Category } from '@/core/entities/category';
import type { Executor } from '@/infra/database/client';
import { db } from '@/infra/database/client';
import { categories } from '@/infra/database/schema';

type CategoryRow = typeof categories.$inferSelect;

function toDomain(row: CategoryRow): Category {
  return new Category({
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description ?? undefined,
    color: row.color ?? undefined,
    archived: row.archived,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export class DrizzleCategoryRepository implements CategoryRepository {
  constructor(private readonly executor: Executor = db) {}

  async findById(id: string): Promise<Category | null> {
    const [row] = await this.executor
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);

    return row ? toDomain(row) : null;
  }

  async findByUserId(userId: string): Promise<Category[]> {
    const rows = await this.executor
      .select()
      .from(categories)
      .where(eq(categories.userId, userId));

    return rows.map(toDomain);
  }

  async save(category: Category): Promise<void> {
    const values = {
      id: category.id,
      userId: category.userId,
      name: category.name,
      description: category.description ?? null,
      color: category.color ?? null,
      archived: category.archived,
      updatedAt: category.props.updatedAt,
    };

    await this.executor
      .insert(categories)
      .values({ ...values, createdAt: category.props.createdAt })
      .onConflictDoUpdate({ target: categories.id, set: values });
  }

  async delete(id: string): Promise<void> {
    await this.executor.delete(categories).where(eq(categories.id, id));
  }
}
