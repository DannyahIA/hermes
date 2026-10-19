import type {
  CaptureEvent,
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
    options?: { statuses?: CaptureStatus[]; limit?: number },
  ): Promise<CaptureEvent[]>;
  /** The ones still waiting for this card to get an account, oldest first. */
  findWaitingForCard(walletCardId: string): Promise<CaptureEvent[]>;
  save(event: CaptureEvent): Promise<void>;
}
