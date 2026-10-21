export type ChatChannelKind = 'telegram';

export interface ChatLinkProps {
  id: string;
  userId: string;
  channel: ChatChannelKind;
  /** The chat's id in the channel (a Telegram chat id). */
  externalChatId: string;
  /** "@dan", when the channel has one. */
  username?: string;
  linkedAt: Date;
  revokedAt?: Date;
}

/**
 * A chat the user connected to Hermes: where payments are announced, and
 * whose messages and buttons are taken as the user's.
 */
export class ChatLink {
  constructor(public readonly props: ChatLinkProps) {}

  get id() {
    return this.props.id;
  }
  get userId() {
    return this.props.userId;
  }
  get externalChatId() {
    return this.props.externalChatId;
  }
  get username() {
    return this.props.username;
  }
  get linkedAt() {
    return this.props.linkedAt;
  }
  get active() {
    return this.props.revokedAt === undefined;
  }

  revoke(now: Date): ChatLink {
    return this.active ? new ChatLink({ ...this.props, revokedAt: now }) : this;
  }
}
