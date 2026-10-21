import net from 'node:net';

/**
 * Telegram's servers are in Europe: from here a connection takes 200 to
 * 350 ms. Since Tailscale gave this machine an IPv6 address, the system
 * also offers Telegram's IPv6 address — which the network can't reach —
 * and Node's Happy Eyeballs gives IPv4 only 250 ms before moving on to
 * it, so a slow IPv4 connection failed as ETIMEDOUT. Two seconds keeps the
 * fallback and lets IPv4 connect. Process-wide, as fetch has no setting
 * of its own for it.
 */
const CONNECT_ATTEMPT_MS = 2_000;

function allowSlowConnections() {
  if (net.getDefaultAutoSelectFamilyAttemptTimeout() < CONNECT_ATTEMPT_MS) {
    net.setDefaultAutoSelectFamilyAttemptTimeout(CONNECT_ATTEMPT_MS);
  }
}

/** The system's code for a failed request ("ETIMEDOUT"), which never holds the URL. */
function networkCode(error: unknown): string | undefined {
  const cause = (error as { cause?: { code?: unknown } } | null)?.cause;
  return typeof cause?.code === 'string' && /^[A-Z_]+$/.test(cause.code)
    ? cause.code
    : undefined;
}

/** What the Bot API said when a call failed. Its message never carries the bot token. */
export class TelegramApiError extends Error {
  constructor(
    readonly method: string,
    readonly status: number | undefined,
    readonly description: string,
    /** Seconds Telegram asks to wait before calling again (429). */
    readonly retryAfter?: number,
  ) {
    super(
      `Telegram ${method} failed (${status ?? 'no status'}): ${description}`,
    );
    this.name = 'TelegramApiError';
  }
}

interface BotApiAnswer<T> {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
  parameters?: { retry_after?: number };
}

/**
 * The Telegram Bot API over plain `fetch` (spec 2026-10-17-telegram-apple-
 * pay-design.md §4.1: no SDK, nothing new to install). Every method is a
 * POST with a JSON body to https://api.telegram.org/bot<token>/<method>.
 */
export class TelegramBotApi {
  constructor(
    private readonly token: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    allowSlowConnections();
  }

  async call<T>(
    method: string,
    params: Record<string, unknown> = {},
    options: { signal?: AbortSignal } = {},
  ): Promise<T> {
    let response: Response;
    try {
      response = await this.fetcher(
        `https://api.telegram.org/bot${this.token}/${method}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(params),
          signal: options.signal,
        },
      );
    } catch (error) {
      if (options.signal?.aborted) throw error;
      // The request's own message may spell out the URL, and the URL holds
      // the token: only the system's code goes along.
      const code = networkCode(error);
      throw new TelegramApiError(
        method,
        undefined,
        code ? `network error (${code})` : 'network error',
      );
    }

    let answer: BotApiAnswer<T>;
    try {
      answer = (await response.json()) as BotApiAnswer<T>;
    } catch {
      throw new TelegramApiError(method, response.status, 'unreadable answer');
    }
    if (!answer.ok) {
      throw new TelegramApiError(
        method,
        answer.error_code ?? response.status,
        answer.description ?? 'unknown error',
        answer.parameters?.retry_after,
      );
    }
    return answer.result as T;
  }
}
