'use server';

import { revalidatePath } from 'next/cache';

import { TRANSACTION_VIEW_MODES } from '@/config/constants';
import { ROUTES } from '@/config/routes';
import { DomainError } from '@/core/errors/domain-error';
import { requireCurrentUserId } from '@/infra/auth/session';
import { DrizzleViewPreferenceRepository } from '@/infra/repositories/drizzle-view-preference.repository';
import { SetViewPreferenceUseCase } from '@/modules/preferences/application/set-view-preference.use-case';

// Kept as a plain array (rather than a Set) so it's trivial for a future
// screen to extend with `.includes()` still reading naturally.
const ALLOWED_SCREEN_KEYS: readonly string[] = ['transactions'];
const ALLOWED_VIEW_MODES: readonly string[] = TRANSACTION_VIEW_MODES;

export async function setViewPreferenceAction(
  screenKey: string,
  viewMode: string,
): Promise<void> {
  if (!ALLOWED_SCREEN_KEYS.includes(screenKey)) {
    throw new DomainError('screenKey inválido.', 'INVALID_SCREEN_KEY');
  }
  if (!ALLOWED_VIEW_MODES.includes(viewMode)) {
    throw new DomainError('viewMode inválido.', 'INVALID_VIEW_MODE');
  }

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
