'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/routes';
import { requireCurrentUserId } from '@/infra/auth/session';
import { DrizzleViewPreferenceRepository } from '@/infra/repositories/drizzle-view-preference.repository';
import { SetViewPreferenceUseCase } from '@/modules/preferences/application/set-view-preference.use-case';

export async function setViewPreferenceAction(
  screenKey: string,
  viewMode: string,
): Promise<void> {
  const userId = await requireCurrentUserId();
  await new SetViewPreferenceUseCase(
    new DrizzleViewPreferenceRepository(),
  ).execute({
    userId,
    screenKey,
    viewMode,
  });
  revalidatePath(ROUTES.transactions);
}
