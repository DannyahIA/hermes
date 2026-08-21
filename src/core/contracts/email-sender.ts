export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

/**
 * Abstracts transactional email delivery away from whichever provider
 * sends it (today: Resend, with a console-log fallback in development) —
 * per architecture.md's "Infrastructure is Replaceable" rule.
 */
export interface EmailSender {
  send(input: SendEmailInput): Promise<void>;
}
