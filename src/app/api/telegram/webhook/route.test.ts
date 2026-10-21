import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.fn<(update: unknown) => Promise<void>>(async () => {});

vi.mock('@/config/env', () => ({
  env: { TELEGRAM_WEBHOOK_SECRET: 'segredo-do-webhook' },
}));
vi.mock('@/shared/server/chat', () => ({
  telegramUpdateHandler: () => handle,
}));

function update(secret?: string) {
  return new Request('http://localhost/api/telegram/webhook', {
    method: 'POST',
    headers: secret ? { 'X-Telegram-Bot-Api-Secret-Token': secret } : {},
    body: JSON.stringify({ update_id: 1 }),
  });
}

describe('POST /api/telegram/webhook', () => {
  beforeEach(() => handle.mockClear());

  it('turns away a call without Telegram’s secret, before reading it', async () => {
    const { POST } = await import('./route');

    expect((await POST(update())).status).toBe(401);
    expect((await POST(update('outro-segredo'))).status).toBe(401);
    expect(handle).not.toHaveBeenCalled();
  });

  it('hands the update over when the secret is right', async () => {
    const { POST } = await import('./route');

    const response = await POST(update('segredo-do-webhook'));

    expect(response.status).toBe(200);
    expect(handle).toHaveBeenCalledWith({ update_id: 1 });
  });

  it('answers ok even when handling fails, so Telegram does not resend it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    handle.mockRejectedValueOnce(new Error('boom'));
    const { POST } = await import('./route');

    expect((await POST(update('segredo-do-webhook'))).status).toBe(200);
  });
});
