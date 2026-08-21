import { Resend } from 'resend';

import { env, isEmailSendingConfigured } from '@/config/env';
import type {
  EmailSender,
  SendEmailInput,
} from '@/core/contracts/email-sender';

/**
 * Sends transactional email via Resend. When `RESEND_API_KEY` isn't set
 * (e.g. local development without a provider configured yet), it logs the
 * email to the console instead of throwing — the auth flows stay fully
 * testable without a real provider, and switching to real delivery later
 * is just setting one env var.
 */
export class ResendEmailSender implements EmailSender {
  private readonly client = isEmailSendingConfigured()
    ? new Resend(env.RESEND_API_KEY)
    : null;

  async send(input: SendEmailInput): Promise<void> {
    if (!this.client) {
      const link = extractFirstLink(input.html);
      console.info(
        `[email:dev-fallback] To: ${input.to} | Subject: ${input.subject}\n` +
          (link ? `Link: ${link}\n` : '') +
          stripHtml(input.html),
      );
      return;
    }

    const result = await this.client.emails.send({
      from: env.EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });

    if (result.error) {
      throw new Error(
        `Failed to send email via Resend: ${result.error.message}`,
      );
    }
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractFirstLink(html: string): string | null {
  return html.match(/href="([^"]+)"/)?.[1] ?? null;
}
