import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const execute = vi.fn();
const findActiveByUserId = vi.fn();
const send = vi.fn();
const telegramChannel = vi.fn();
const after = vi.fn();

vi.mock('next/server', () => ({ after }));
vi.mock('./chat', () => ({ telegramChannel }));
vi.mock('@/modules/budgets/application/check-budget-alerts.use-case', () => ({
  CheckBudgetAlertsUseCase: class {
    execute = execute;
  },
}));
vi.mock('@/infra/repositories/drizzle-chat-link.repository', () => ({
  DrizzleChatLinkRepository: class {
    findActiveByUserId = findActiveByUserId;
  },
}));
vi.mock('@/infra/repositories/drizzle-budget.repository', () => ({
  DrizzleBudgetRepository: class {},
}));
vi.mock('@/infra/repositories/drizzle-budget-alert-log.repository', () => ({
  DrizzleBudgetAlertLogRepository: class {},
}));
vi.mock('@/infra/repositories/drizzle-category.repository', () => ({
  DrizzleCategoryRepository: class {},
}));
vi.mock('@/infra/repositories/drizzle-transaction.repository', () => ({
  DrizzleTransactionRepository: class {},
}));

const { budgetAlertsFor, checkBudgetAlerts, sendBudgetAlertsToChat } =
  await import('./budget-alerts');

const LINE = 'Mercado: 75% do orçamento (R$ 375,00 de R$ 500,00).';

beforeEach(() => {
  telegramChannel.mockReturnValue({ send });
  findActiveByUserId.mockResolvedValue({ externalChatId: 'chat-1' });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('checkBudgetAlerts', () => {
  it('returns the lines the check worked out', async () => {
    execute.mockResolvedValue([LINE]);

    await expect(checkBudgetAlerts('user-1', ['tx-1'])).resolves.toEqual([
      LINE,
    ]);
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', transactionIds: ['tx-1'] }),
    );
  });

  it('checks nothing when there are no purchases', async () => {
    await expect(checkBudgetAlerts('user-1', [])).resolves.toEqual([]);
    expect(execute).not.toHaveBeenCalled();
  });

  it('never fails the purchase: logs the ids and returns nothing', async () => {
    execute.mockRejectedValue(new Error('db down'));

    await expect(checkBudgetAlerts('user-1', ['tx-1'])).resolves.toEqual([]);
    expect(console.error).toHaveBeenCalledWith(
      'budget alert check of tx-1 failed:',
      'db down',
    );
  });
});

describe('sendBudgetAlertsToChat', () => {
  it('sends the lines to the active chat as one message', async () => {
    await sendBudgetAlertsToChat('user-1', [LINE, 'Lazer: 90%.']);

    expect(send).toHaveBeenCalledWith('chat-1', {
      text: `${LINE}\nLazer: 90%.`,
    });
  });

  it('says nothing without a linked chat', async () => {
    findActiveByUserId.mockResolvedValue(null);

    await sendBudgetAlertsToChat('user-1', [LINE]);

    expect(send).not.toHaveBeenCalled();
  });

  it('says nothing when the bot is not set up', async () => {
    telegramChannel.mockReturnValue(null);

    await sendBudgetAlertsToChat('user-1', [LINE]);

    expect(findActiveByUserId).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('does not throw when the chat cannot be reached', async () => {
    send.mockRejectedValue(new Error('telegram down'));

    await expect(
      sendBudgetAlertsToChat('user-1', [LINE]),
    ).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});

describe('budgetAlertsFor', () => {
  it('returns the lines and schedules the chat send after the response', async () => {
    execute.mockResolvedValue([LINE]);

    await expect(budgetAlertsFor('user-1', ['tx-1'])).resolves.toEqual([LINE]);
    expect(after).toHaveBeenCalledTimes(1);

    await after.mock.calls[0][0]();
    expect(send).toHaveBeenCalledWith('chat-1', { text: LINE });
  });

  it('schedules nothing when there is nothing to tell', async () => {
    execute.mockResolvedValue([]);

    await expect(budgetAlertsFor('user-1', ['tx-1'])).resolves.toEqual([]);
    expect(after).not.toHaveBeenCalled();
  });
});
