import type { ViewPreferenceRepository } from '@/core/contracts/view-preference-repository';
import { GetViewPreferenceUseCase } from '@/modules/preferences/application/get-view-preference.use-case';
import { SetViewPreferenceUseCase } from '@/modules/preferences/application/set-view-preference.use-case';

/**
 * Telegram conversations aren't end-to-end encrypted (spec 2026-10-17-
 * telegram-apple-pay-design.md §8, D5): the user may keep what is free to
 * spend out of them. Kept as the chat's view preference.
 */
const CHAT_SCREEN = 'telegram';
const SHOW_FREE = 'show-free';
const HIDE_FREE = 'hide-free';

/** Whether payment messages say what is still free to spend; yes unless turned off. */
export class GetChatPrivacyUseCase {
  constructor(private readonly preferences: ViewPreferenceRepository) {}

  async execute(userId: string): Promise<{ showFree: boolean }> {
    const mode = await new GetViewPreferenceUseCase(this.preferences).execute(
      userId,
      CHAT_SCREEN,
      SHOW_FREE,
    );
    return { showFree: mode !== HIDE_FREE };
  }
}

export class SetChatPrivacyUseCase {
  constructor(private readonly preferences: ViewPreferenceRepository) {}

  async execute(input: { userId: string; showFree: boolean }): Promise<void> {
    await new SetViewPreferenceUseCase(this.preferences).execute({
      userId: input.userId,
      screenKey: CHAT_SCREEN,
      viewMode: input.showFree ? SHOW_FREE : HIDE_FREE,
    });
  }
}
