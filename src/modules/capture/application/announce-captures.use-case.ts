import type { ChatChannel } from '@/core/contracts/chat-channel';
import type { CaptureEvent } from '@/core/entities/capture-event';

import { AnnounceBudgetAlertsUseCase } from './announce-budget-alerts.use-case';
import type { ChatUnitOfWork } from './chat-dependencies';
import { describeCapture, storyMessage } from './describe-capture';

const transactionOf = (event: CaptureEvent) =>
  event.transactionId ? [event.transactionId] : [];

/** An ending (let go, undone, deleted) only updates a message already sent. */
const OPENS_A_CONVERSATION = new Set([
  'recorded',
  'needs_account',
  'needs_confirm',
]);

interface Delivered {
  captureId: string;
  chatMessageId?: string;
  chatPromptId?: string;
}

/**
 * Tells the user's chat where some captures stand (spec 2026-10-17-
 * telegram-apple-pay-design.md §5.3, step 8): a new payment gets its
 * message, one already told about has its message brought up to date, and
 * one without an amount is asked for it, once, as a reply. A payment that
 * ended (let go or undone in the app) is never news of its own. Nothing is
 * said without a connected chat — the captures stand on their own. A
 * purchase that took a budget to a new stage is followed by a message of its
 * own about it.
 */
export class AnnounceCapturesUseCase {
  private readonly budgetAlerts: AnnounceBudgetAlertsUseCase;

  constructor(
    private readonly channel: ChatChannel,
    private readonly run: ChatUnitOfWork,
  ) {
    this.budgetAlerts = new AnnounceBudgetAlertsUseCase(channel, run);
  }

  async execute(input: {
    userId: string;
    captureIds: string[];
    now?: Date;
  }): Promise<void> {
    if (input.captureIds.length === 0) return;
    const now = input.now ?? new Date();

    const told = await this.run(async (deps) => {
      const link = await deps.chatLinks.findActiveByUserId(input.userId);
      if (!link) return null;
      const stories = [];
      for (const captureId of input.captureIds) {
        const event = await deps.captureEvents.findById(captureId);
        if (!event || event.userId !== input.userId) continue;
        stories.push({ event, story: await describeCapture(deps, event, now) });
      }
      return { chatId: link.externalChatId, stories };
    });
    if (!told) return;

    const delivered: Delivered[] = [];
    const purchases: string[] = [];
    for (const { event, story } of told.stories) {
      const message = storyMessage(story);
      if (story.kind === 'needs_amount') {
        if (event.chatPromptId) continue;
        const { messageId } = await this.channel.send(told.chatId, message);
        delivered.push({ captureId: event.id, chatPromptId: messageId });
      } else if (event.chatMessageId) {
        await this.channel.edit(told.chatId, event.chatMessageId, message);
        if (story.kind === 'recorded') purchases.push(...transactionOf(event));
      } else if (OPENS_A_CONVERSATION.has(story.kind)) {
        const { messageId } = await this.channel.send(told.chatId, message);
        // The question about its amount, if there was one, is answered.
        delivered.push({ captureId: event.id, chatMessageId: messageId });
        if (story.kind === 'recorded') purchases.push(...transactionOf(event));
      }
    }

    if (delivered.length > 0) await this.keep(delivered, now);
    await this.budgetAlerts.execute({
      userId: input.userId,
      transactionIds: purchases,
      now,
    });
  }

  /** Remembers which message tells about each capture. */
  private async keep(delivered: Delivered[], now: Date): Promise<void> {
    await this.run(async (deps) => {
      for (const { captureId, ...ids } of delivered) {
        const event = await deps.captureEvents.findById(captureId);
        if (!event) continue;
        await deps.captureEvents.save(
          event.with(
            ids.chatMessageId
              ? { chatMessageId: ids.chatMessageId, chatPromptId: undefined }
              : { chatPromptId: ids.chatPromptId },
            now,
          ),
        );
      }
    });
  }
}
