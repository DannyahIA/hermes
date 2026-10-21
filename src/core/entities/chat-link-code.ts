export interface ChatLinkCodeProps {
  code: string;
  userId: string;
  expiresAt: Date;
  usedAt?: Date;
}

/**
 * Proof that whoever starts the bot is the user signed in to Hermes: a
 * one-time code carried by the "Abrir no Telegram" link, good for minutes.
 */
export class ChatLinkCode {
  constructor(public readonly props: ChatLinkCodeProps) {}

  get code() {
    return this.props.code;
  }
  get userId() {
    return this.props.userId;
  }

  usableAt(now: Date): boolean {
    return this.props.usedAt === undefined && now < this.props.expiresAt;
  }

  use(now: Date): ChatLinkCode {
    return new ChatLinkCode({ ...this.props, usedAt: now });
  }
}
