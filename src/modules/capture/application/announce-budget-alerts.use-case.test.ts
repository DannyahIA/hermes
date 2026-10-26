import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Budget } from '@/core/entities/budget';
import { Category } from '@/core/entities/category';
import { ChatLink } from '@/core/entities/chat-link';
import { Transaction } from '@/core/entities/transaction';
import { FakeChatChannel } from '@/tests/fakes/fake-chat-channel';
import { fakeChatDependencies } from '@/tests/fakes/fake-chat-dependencies';

import { AnnounceBudgetAlertsUseCase } from './announce-budget-alerts.use-case';

const USER_ID = 'user-1';
const CHAT_ID = '5551234';
/** Late enough in October that 75% is not ahead of the calendar. */
const NOW = new Date(2026, 9, 25, 12);
const MERCADO = 'mercado';

describe('announcing a budget stage in the chat', () => {
  let world: ReturnType<typeof fakeChatDependencies>;
  let channel: FakeChatChannel;
  let announce: AnnounceBudgetAlertsUseCase;

  async function purchase(transactionId: string, amount: number) {
    await world.deps.transactions.save(
      new Transaction({
        id: transactionId,
        accountId: 'acc-1',
        categoryId: MERCADO,
        description: 'Compra',
        amount,
        type: 'expense',
        occurredAt: new Date(2026, 9, 24),
        createdAt: NOW,
        updatedAt: NOW,
      }),
    );
  }

  const link = () =>
    world.deps.chatLinks.save(
      new ChatLink({
        id: 'link-1',
        userId: USER_ID,
        channel: 'telegram',
        externalChatId: CHAT_ID,
        linkedAt: NOW,
      }),
    );

  beforeEach(async () => {
    world = fakeChatDependencies();
    channel = new FakeChatChannel();
    announce = new AnnounceBudgetAlertsUseCase(channel, world.run);
    await world.deps.categories.save(
      new Category({
        id: MERCADO,
        userId: USER_ID,
        name: 'Mercado',
        archived: false,
        createdAt: NOW,
        updatedAt: NOW,
      }),
    );
    await world.deps.budgets.save(
      new Budget({
        id: 'budget-1',
        userId: USER_ID,
        categoryId: MERCADO,
        amount: 100,
        currency: 'BRL',
        kind: 'monthly',
        limits: [],
        periodStart: new Date(2026, 9, 1),
        periodEnd: null,
        createdAt: NOW,
        updatedAt: NOW,
      }),
    );
  });

  it('sends the lines as one plain message to the active chat', async () => {
    await link();
    await purchase('t1', 80);

    const lines = await announce.execute({
      userId: USER_ID,
      transactionIds: ['t1'],
      now: NOW,
    });

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^Mercado: 75% do orçamento/);
    expect(channel.sent).toEqual([
      { chatId: CHAT_ID, messageId: '100', text: lines.join('\n') },
    ]);
  });

  it('tells a stage once', async () => {
    await link();
    await purchase('t1', 80);
    const input = { userId: USER_ID, transactionIds: ['t1'], now: NOW };
    await announce.execute(input);

    expect(await announce.execute(input)).toEqual([]);

    expect(channel.sent).toHaveLength(1);
  });

  it('stays quiet without an active chat link but still returns the lines', async () => {
    await purchase('t1', 80);

    const lines = await announce.execute({
      userId: USER_ID,
      transactionIds: ['t1'],
      now: NOW,
    });

    expect(lines).toHaveLength(1);
    expect(channel.sent).toEqual([]);
  });

  it('sends nothing when no stage was reached', async () => {
    await link();
    await purchase('t1', 20);

    const lines = await announce.execute({
      userId: USER_ID,
      transactionIds: ['t1'],
      now: NOW,
    });

    expect(lines).toEqual([]);
    expect(channel.sent).toEqual([]);
  });

  it('does nothing for no purchases', async () => {
    await link();

    expect(
      await announce.execute({ userId: USER_ID, transactionIds: [], now: NOW }),
    ).toEqual([]);
    expect(channel.sent).toEqual([]);
  });

  it('keeps the lines and logs only ids when the chat cannot be reached', async () => {
    await link();
    await purchase('t1', 80);
    channel.send = async () => {
      throw new Error('chat unreachable');
    };
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    const lines = await announce.execute({
      userId: USER_ID,
      transactionIds: ['t1'],
      now: NOW,
    });

    expect(lines).toHaveLength(1);
    expect(log).toHaveBeenCalledOnce();
    expect(log.mock.calls[0].join(' ')).toContain('t1');
    expect(log.mock.calls[0].join(' ')).not.toMatch(/80|75%/);
    log.mockRestore();
  });
  it('returns no lines and logs only ids when the check itself fails', async () => {
    await link();
    await purchase('t1', 80);
    world.deps.budgetAlerts.warned = async () => {
      throw new Error('database down');
    };
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    const lines = await announce.execute({
      userId: USER_ID,
      transactionIds: ['t1'],
      now: NOW,
    });

    expect(lines).toEqual([]);
    expect(channel.sent).toEqual([]);
    expect(log).toHaveBeenCalledOnce();
    expect(log.mock.calls[0].join(' ')).toContain('t1');
    log.mockRestore();
  });
});
