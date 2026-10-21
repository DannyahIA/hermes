import type {
  CaptureEvent,
  CaptureSource,
  CaptureStatus,
} from '@/core/entities/capture-event';

export interface CaptureEventRepository {
  findById(id: string): Promise<CaptureEvent | null>;
  findByKey(
    userId: string,
    idempotencyKey: string,
  ): Promise<CaptureEvent | null>;
  /** Newest first. */
  findByUserId(
    userId: string,
    options?: {
      statuses?: CaptureStatus[];
      sources?: CaptureSource[];
      limit?: number;
    },
  ): Promise<CaptureEvent[]>;
  /** The capture a chat question (its amount) was asked about. */
  findByChatPrompt(
    userId: string,
    chatPromptId: string,
  ): Promise<CaptureEvent | null>;
  /** The ones still waiting for this card to get an account, oldest first. */
  findWaitingForCard(walletCardId: string): Promise<CaptureEvent[]>;
  save(event: CaptureEvent): Promise<void>;
}
