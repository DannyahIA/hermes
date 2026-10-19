export type CaptureSource = 'wallet';

/**
 * `recorded` became a transaction (which may since have been deleted);
 * `needs_account` waits for its Wallet card to be given an account;
 * `needs_amount` arrived without a value; `discarded` was let go.
 */
export type CaptureStatus =
  'recorded' | 'needs_account' | 'needs_amount' | 'discarded';

/** What a capture reported, kept as it came. */
export interface CapturePayload {
  /** "R$ 23,90", "23.9", 23.9, or nothing. */
  amount: string | number | null;
  merchant: string | null;
  card: string | null;
  /** When it happened, ISO 8601. */
  occurredAt: string;
}

export interface CaptureEventProps {
  id: string;
  userId: string;
  source: CaptureSource;
  idempotencyKey: string;
  payload: CapturePayload;
  status: CaptureStatus;
  walletCardId?: string;
  transactionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * One payment a capture reported, recorded or not. A repeat of it is
 * answered from here instead of recorded twice, and one still missing its
 * account or amount waits here until the user supplies it.
 */
export class CaptureEvent {
  constructor(public readonly props: CaptureEventProps) {}

  get id() {
    return this.props.id;
  }
  get userId() {
    return this.props.userId;
  }
  get status() {
    return this.props.status;
  }
  get payload() {
    return this.props.payload;
  }
  get walletCardId() {
    return this.props.walletCardId;
  }
  get transactionId() {
    return this.props.transactionId;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get pending() {
    return (
      this.props.status === 'needs_account' ||
      this.props.status === 'needs_amount'
    );
  }

  with(
    changes: Partial<
      Pick<CaptureEventProps, 'status' | 'payload' | 'transactionId'>
    >,
    now: Date,
  ): CaptureEvent {
    return new CaptureEvent({ ...this.props, ...changes, updatedAt: now });
  }
}
