import { beforeEach, describe, expect, it } from 'vitest';

import { Account } from '@/core/entities/account';
import { fakeChatDependencies } from '@/tests/fakes/fake-chat-dependencies';

import {
  ConfirmChatEntryUseCase,
  RecordChatEntryUseCase,
} from './record-chat-entry.use-case';

const USER_ID = 'user-1';
const NOW = new Date(2026, 9, 19, 12, 42);
const CREDITO = '00000000-0000-4000-8000-000000000001';
const CONTA = '00000000-0000-4000-8000-000000000002';

function account(id: string, name: string, type: 'checking' | 'credit') {
  return new Account({
    id,
    userId: USER_ID,
    name,
    type,
    balance: 0,
    currency: 'BRL',
    archived: false,
    hidden: false,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

describe('an entry written in the chat', () => {
  let world: ReturnType<typeof fakeChatDependencies>;
  let record: RecordChatEntryUseCase;
  let messages = 0;

  const write = (text: string, key = `telegram:1:${(messages += 1)}`) =>
    record.execute({ userId: USER_ID, key, text, now: NOW });
  const transactions = () =>
    world.deps.transactions.findByUserId(USER_ID, { pageSize: 100 });

  beforeEach(async () => {
    world = fakeChatDependencies();
    record = new RecordChatEntryUseCase(world.deps);
    await world.deps.accounts.save(
      account(CREDITO, 'Nubank Crédito', 'credit'),
    );
    await world.deps.accounts.save(account(CONTA, 'Nubank Conta', 'checking'));
  });

  it('is recorded as it was understood, marked as from the chat', async () => {
    const outcome = await write('almoço 32,50');

    expect(outcome).toMatchObject({ kind: 'recorded', repeated: false });
    const [transaction] = await transactions();
    expect(transaction).toMatchObject({
      description: 'Almoço',
      amount: 32.5,
      type: 'expense',
      accountId: CREDITO,
      source: 'telegram',
    });
    const event = await world.deps.captureEvents.findById(
      outcome.kind === 'recorded' ? outcome.captureId : '',
    );
    expect(event?.props.source).toBe('telegram_text');
    expect(event?.transactionId).toBe(transaction.id);
  });

  it('goes to the account or the kind of account it names', async () => {
    await write('uber 18 débito');
    await write('+300 salário');

    const byDescription = Object.fromEntries(
      (await transactions()).map((transaction) => [
        transaction.description,
        transaction,
      ]),
    );
    expect(byDescription.Uber.accountId).toBe(CONTA);
    expect(byDescription['Salário']).toMatchObject({
      type: 'income',
      accountId: CONTA,
    });
  });

  it('is recorded once, however many times the same message arrives', async () => {
    await write('almoço 32,50', 'telegram:1:500');
    const again = await write('almoço 32,50', 'telegram:1:500');

    expect(again).toMatchObject({ repeated: true });
    expect(await transactions()).toHaveLength(1);
  });

  it('waits for a yes above R$ 500, then records it', async () => {
    const outcome = await write('mercado 870');

    expect(outcome).toMatchObject({ kind: 'needs_confirm' });
    expect(await transactions()).toHaveLength(0);

    const captureId = outcome.kind === 'needs_confirm' ? outcome.captureId : '';
    await new ConfirmChatEntryUseCase(world.deps).execute({
      userId: USER_ID,
      captureId,
      now: NOW,
    });

    const [transaction] = await transactions();
    expect(transaction).toMatchObject({ description: 'Mercado', amount: 870 });
    expect((await world.deps.captureEvents.findById(captureId))?.status).toBe(
      'recorded',
    );
  });

  it('waits for a yes when two numbers could be the amount', async () => {
    expect(await write('2 pizzas 80')).toMatchObject({ kind: 'needs_confirm' });
  });

  it('says what is missing instead of recording a line it can’t read', async () => {
    expect(await write('oi')).toEqual({
      kind: 'unreadable',
      reply:
        'Não achei o valor. Mande numa linha, como "almoço 32,50", ou veja /ajuda.',
    });
    expect(await write('99999999999,00 mercado')).toMatchObject({
      kind: 'unreadable',
    });
    expect(await transactions()).toHaveLength(0);
  });
});
