import { and, asc, desc, eq, inArray } from 'drizzle-orm';

import type { CaptureEventRepository } from '@/core/contracts/capture-event-repository';
import {
  CaptureEvent,
  type CapturePayload,
  type CaptureSource,
  type CaptureStatus,
} from '@/core/entities/capture-event';
import type { Executor } from '@/infra/database/client';
import { db } from '@/infra/database/client';
import { captureEvents } from '@/infra/database/schema';

type CaptureEventRow = typeof captureEvents.$inferSelect;

function toDomain(row: CaptureEventRow): CaptureEvent {
  return new CaptureEvent({
    id: row.id,
    userId: row.userId,
    source: row.source as CaptureSource,
    idempotencyKey: row.idempotencyKey,
    payload: row.payload as CapturePayload,
    status: row.status as CaptureStatus,
    walletCardId: row.walletCardId ?? undefined,
    transactionId: row.transactionId ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export class DrizzleCaptureEventRepository implements CaptureEventRepository {
  constructor(private readonly executor: Executor = db) {}

  async findById(id: string): Promise<CaptureEvent | null> {
    const [row] = await this.executor
      .select()
      .from(captureEvents)
      .where(eq(captureEvents.id, id))
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async findByKey(
    userId: string,
    idempotencyKey: string,
  ): Promise<CaptureEvent | null> {
    const [row] = await this.executor
      .select()
      .from(captureEvents)
      .where(
        and(
          eq(captureEvents.userId, userId),
          eq(captureEvents.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async findByUserId(
    userId: string,
    options: { statuses?: CaptureStatus[]; limit?: number } = {},
  ): Promise<CaptureEvent[]> {
    const conditions = [eq(captureEvents.userId, userId)];
    if (options.statuses) {
      conditions.push(inArray(captureEvents.status, options.statuses));
    }
    const rows = await this.executor
      .select()
      .from(captureEvents)
      .where(and(...conditions))
      .orderBy(desc(captureEvents.createdAt))
      .limit(options.limit ?? 200);
    return rows.map(toDomain);
  }

  async findWaitingForCard(walletCardId: string): Promise<CaptureEvent[]> {
    const rows = await this.executor
      .select()
      .from(captureEvents)
      .where(
        and(
          eq(captureEvents.walletCardId, walletCardId),
          eq(captureEvents.status, 'needs_account'),
        ),
      )
      .orderBy(asc(captureEvents.createdAt));
    return rows.map(toDomain);
  }

  async save(event: CaptureEvent): Promise<void> {
    const values = {
      payload: event.payload,
      status: event.status,
      walletCardId: event.walletCardId ?? null,
      transactionId: event.transactionId ?? null,
      updatedAt: event.props.updatedAt,
    };
    await this.executor
      .insert(captureEvents)
      .values({
        ...values,
        id: event.id,
        userId: event.userId,
        source: event.props.source,
        idempotencyKey: event.props.idempotencyKey,
        createdAt: event.createdAt,
      })
      .onConflictDoUpdate({ target: captureEvents.id, set: values });
  }
}
