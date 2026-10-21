import { beforeEach, describe, expect, it } from 'vitest';

import { Account } from '@/core/entities/account';
import { Transaction } from '@/core/entities/transaction';
import { fakeChatDependencies } from '@/tests/fakes/fake-chat-dependencies';

import { decodeChatAction } from '../domain/chat-action';
import { HELP_REPLY, PRIVATE_REPLY } from '../domain/chat-replies';
import { AnswerChatCommandUseCase } from './answer-chat-command.use-case';
import { SetChatPrivacyUseCase } from './chat-privacy.use-case';
import { RecordChatEntryUseCase } from './record-chat-entry.use-case';

const USER_ID = 'user-1';
const NOW = new Date(2026, 9, 19, 15, 0);
const CREDITO = '00000000-0000-4000-8000-000000000001';
const CONTA = '00000000-0000-4000-8000-000000000002';

const plain = (text: string) => text.replace(/ /g, ' ');

function account(
  id: string,
  name: string,
  type: 'checking' | 'credit',
  balance: number,
) {
  return new Account({
    id,
    userId: USER_ID,
    name,
    type,
    balance,
    currency: 'BRL',
    closingDay: type === 'credit' ? 3 : undefined,
    dueDay: type === 'credit' ? 10 : undefined,
    archived: false,
    hidden: false,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

function spent(description: string, amount: number, at: Date) {
  return new Transaction({
    id: `${description}-${at.getTime()}`,
    accountId: CREDITO,
    description,
    amount,
    type: 'expense',
    occurredAt: at,
    createdAt: at,
    updatedAt: at,
  });
}

describe('answering the chat’s commands', () => {
  let world: ReturnType<typeof fakeChatDependencies>;
  let answer: (
    command: Parameters<AnswerChatCommandUseCase['execute']>[0]['command'],
  ) => Promise<{ text: string; buttons?: { data: string }[][] }>;

  beforeEach(async () => {
    world = fakeChatDependencies();
    const useCase = new AnswerChatCommandUseCase(world.deps);
    answer = (command) =>
      useCase.execute({ userId: USER_ID, command, now: NOW });
    await world.deps.accounts.save(
      account(CREDITO, 'Nubank Crédito', 'credit', 64),
    );
    await world.deps.accounts.save(
      account(CONTA, 'Nubank Conta', 'checking', 4000),
    );
  });

  it('/livre tells what is free until the end of the month', async () => {
    const { text } = await answer('livre');

    expect(plain(text).split('\n')).toEqual([
      'Livre até o fim do mês: R$ 3.936,00 (R$ 303 por dia)',
      'Em conta corrente: R$ 4.000,00',
      'Nos cartões: R$ 64,00',
      'Já agendado até lá: R$ 0,00',
    ]);
  });

  it('/fatura tells each card’s statements', async () => {
    await world.deps.transactions.save(
      spent('Mercado', 64, new Date(2026, 9, 12, 10, 0)),
    );

    const { text } = await answer('fatura');

    expect(plain(text).split('\n').slice(0, 2)).toEqual([
      'Nubank Crédito',
      'Aberta: R$ 64,00 · fecha 03/11 · vence 10/11',
    ]);
  });

  it('keeps balances out of the chat when the user asked so', async () => {
    await new SetChatPrivacyUseCase(world.deps.viewPreferences).execute({
      userId: USER_ID,
      showFree: false,
    });

    expect((await answer('livre')).text).toBe(PRIVATE_REPLY);
    expect((await answer('fatura')).text).toBe(PRIVATE_REPLY);
  });

  it('/hoje lists only today’s spending', async () => {
    await world.deps.transactions.save(
      spent('Padaria Real', 23.9, new Date(2026, 9, 19, 12, 41)),
    );
    await world.deps.transactions.save(
      spent('Ontem', 99, new Date(2026, 9, 18, 20, 0)),
    );

    expect(plain((await answer('hoje')).text)).toBe(
      ['Hoje:', '12:41 Padaria Real · R$ 23,90', 'Total: R$ 23,90'].join('\n'),
    );
  });

  it('/desfazer offers to undo the last entry', async () => {
    const recorded = await new RecordChatEntryUseCase(world.deps).execute({
      userId: USER_ID,
      key: 'telegram:1:1',
      text: 'almoço 32,50',
      now: NOW,
    });

    const message = await answer('desfazer');

    expect(plain(message.text)).toBe(
      'Desfazer o último registro?\nAlmoço · R$ 32,50 · hoje 15:00',
    );
    expect(decodeChatAction(message.buttons![0][0].data)).toEqual({
      kind: 'undo',
      captureId: recorded.kind === 'recorded' ? recorded.captureId : '',
    });
  });

  it('/desfazer says when there is nothing to undo', async () => {
    expect((await answer('desfazer')).text).toBe(
      'Nada para desfazer dos últimos 7 dias.',
    );
  });

  it('/ajuda explains how to write an entry', async () => {
    expect((await answer('ajuda')).text).toBe(HELP_REPLY);
  });
});
