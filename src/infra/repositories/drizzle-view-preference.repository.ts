import { and, eq } from 'drizzle-orm';

import type { ViewPreferenceRepository } from '@/core/contracts/view-preference-repository';
import { ViewPreference } from '@/core/entities/view-preference';
import type { Executor } from '@/infra/database/client';
import { db } from '@/infra/database/client';
import { userViewPreferences } from '@/infra/database/schema';

type ViewPreferenceRow = typeof userViewPreferences.$inferSelect;

function toDomain(row: ViewPreferenceRow): ViewPreference {
  return new ViewPreference({
    id: row.id,
    userId: row.userId,
    screenKey: row.screenKey,
    viewMode: row.viewMode,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export class DrizzleViewPreferenceRepository implements ViewPreferenceRepository {
  constructor(private readonly executor: Executor = db) {}

  async findByUserAndScreen(
    userId: string,
    screenKey: string,
  ): Promise<ViewPreference | null> {
    const [row] = await this.executor
      .select()
      .from(userViewPreferences)
      .where(
        and(
          eq(userViewPreferences.userId, userId),
          eq(userViewPreferences.screenKey, screenKey),
        ),
      )
      .limit(1);

    return row ? toDomain(row) : null;
  }

  async save(preference: ViewPreference): Promise<void> {
    const values = {
      userId: preference.userId,
      screenKey: preference.screenKey,
      viewMode: preference.viewMode,
      updatedAt: preference.props.updatedAt,
    };

    await this.executor
      .insert(userViewPreferences)
      .values({
        ...values,
        id: preference.id,
        createdAt: preference.props.createdAt,
      })
      .onConflictDoUpdate({
        target: [userViewPreferences.userId, userViewPreferences.screenKey],
        set: values,
      });
  }
}
