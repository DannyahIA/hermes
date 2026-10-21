/** The iPhone's Wallet, or a line written in the chat. */
export type CaptureSource = 'wallet' | 'telegram_text';

/**
 * `recorded` became a transaction (which may since have been deleted);
 * `needs_account` waits for its Wallet card to be given an account;
 * `needs_amount` arrived without a value; `needs_confirm` is a line from
 * the chat waiting for a yes; `discarded` was let go.
 */
export type CaptureStatus =
  'recorded' | 'needs_account' | 'needs_amount' | 'needs_confirm' | 'discarded';

/** A line from the chat as it was understood (`parseQuickEntry`). */
export interface CaptureEntry {
  description: string;
  amount: number;
  type: 'income' | 'expense';
  accountId: string;
  categoryId?: string;
}

/** What a capture reported, kept as it came. */
export interface CapturePayload {
  /** "R$ 23,90", "23.9", 23.9, or nothing. */
  amount: string | number | null;
  merchant: string | null;
  card: string | null;
  /** When it happened, ISO 8601. */
  occurredAt: string;
  /** A chat entry, kept until it is recorded. */
  entry?: CaptureEntry;
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
  /** The chat message that tells about this payment, with its buttons. */
  chatMessageId?: string;
  /** A question about it awaiting a reply (its amount). */
  chatPromptId?: string;
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
  get source() {
    return this.props.source;
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
  get chatMessageId() {
    return this.props.chatMessageId;
  }
  get chatPromptId() {
    return this.props.chatPromptId;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get pending() {
    return (
      this.props.status === 'needs_account' ||
      this.props.status === 'needs_amount' ||
      this.props.status === 'needs_confirm'
    );
  }

  with(
    changes: Partial<
      Pick<
        CaptureEventProps,
        | 'status'
        | 'payload'
        | 'transactionId'
        | 'chatMessageId'
        | 'chatPromptId'
      >
    >,
    now: Date,
  ): CaptureEvent {
    return new CaptureEvent({ ...this.props, ...changes, updatedAt: now });
  }
}
