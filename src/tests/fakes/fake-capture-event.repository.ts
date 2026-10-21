import type { CaptureEventRepository } from '@/core/contracts/capture-event-repository';
import type {
  CaptureEvent,
  CaptureSource,
  CaptureStatus,
} from '@/core/entities/capture-event';

export class FakeCaptureEventRepository implements CaptureEventRepository {
  private readonly events = new Map<string, CaptureEvent>();

  async findById(id: string): Promise<CaptureEvent | null> {
    return this.events.get(id) ?? null;
  }

  async findByKey(
    userId: string,
    idempotencyKey: string,
  ): Promise<CaptureEvent | null> {
    return (
      [...this.events.values()].find(
        (event) =>
          event.userId === userId &&
          event.props.idempotencyKey === idempotencyKey,
      ) ?? null
    );
  }

  async findByUserId(
    userId: string,
    options: {
      statuses?: CaptureStatus[];
      sources?: CaptureSource[];
      limit?: number;
    } = {},
  ): Promise<CaptureEvent[]> {
    return [...this.events.values()]
      .filter(
        (event) =>
          event.userId === userId &&
          (!options.statuses || options.statuses.includes(event.status)) &&
          (!options.sources || options.sources.includes(event.source)),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, options.limit ?? Number.POSITIVE_INFINITY);
  }

  async findByChatPrompt(
    userId: string,
    chatPromptId: string,
  ): Promise<CaptureEvent | null> {
    return (
      [...this.events.values()].find(
        (event) =>
          event.userId === userId && event.chatPromptId === chatPromptId,
      ) ?? null
    );
  }

  async findWaitingForCard(walletCardId: string): Promise<CaptureEvent[]> {
    return [...this.events.values()]
      .filter(
        (event) =>
          event.walletCardId === walletCardId &&
          event.status === 'needs_account',
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async save(event: CaptureEvent): Promise<void> {
    this.events.set(event.id, event);
  }
}
