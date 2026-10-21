import { describe, expect, it } from 'vitest';

import type { AvailableToSpend } from '@/modules/dashboard/application/metrics/calculate-available-to-spend';
import type { CardStatement } from '@/modules/dashboard/application/metrics/calculate-card-statements';

import { decodeChatAction } from './chat-action';
import {
  billsReply,
  entryProblemReply,
  freeReply,
  HELP_REPLY,
  todayReply,
  undoQuestion,
} from './chat-replies';

const plain = (text: string) => text.replace(/ /g, ' ');
const CAPTURE = '9295c43b-103b-447c-8e8b-ba077b4111d7';

const available: AvailableToSpend = {
  horizon: new Date(2026, 10, 5),
  horizonKind: 'income',
  incomeDescription: 'Salário',
  inChecking: 4000,
  owedOnCards: 1500,
  scheduled: 681.8,
  free: 1818.2,
  daysLeft: 18,
  perDay: 101.01,
};

describe('/livre', () => {
  it('tells the Início’s headline, and where it comes from', () => {
    expect(plain(freeReply(available))).toBe(
      [
        'Livre até 05/11: R$ 1.818,20 (R$ 101 por dia)',
        'Em conta corrente: R$ 4.000,00',
        'Nos cartões: R$ 1.500,00',
        'Já agendado até lá: R$ 681,80',
      ].join('\n'),
    );
  });

  it('says why there is nothing to tell without a checking account', () => {
    expect(freeReply(null)).toBe(
      'Sem conta corrente no Hermes, não dá para calcular quanto está livre.',
    );
  });
});

describe('/fatura', () => {
  const statement = (overrides: Partial<CardStatement>): CardStatement => ({
    accountId: 'c1',
    name: 'Nubank Crédito',
    owed: 1723.1,
    cycle: {
      lastClosing: new Date(2026, 9, 3),
      nextClosing: new Date(2026, 10, 3),
      open: 523.1,
      openDueOn: new Date(2026, 10, 10),
      closedUnpaid: 1200,
      closedDueOn: new Date(2026, 9, 10),
      overdue: true,
    },
    ...overrides,
  });

  it('tells each card’s open and closed statements', () => {
    expect(
      plain(
        billsReply([
          statement({}),
          statement({ name: 'Itaú Crédito', owed: 80, cycle: null }),
        ]),
      ),
    ).toBe(
      [
        'Nubank Crédito',
        'Aberta: R$ 523,10 · fecha 03/11 · vence 10/11',
        'Fechada: R$ 1.200,00 · venceu 10/10',
        '',
        'Itaú Crédito',
        'Devendo R$ 80,00. Cadastre o fechamento e o vencimento no app para ver as faturas.',
      ].join('\n'),
    );
  });

  it('says a closed statement is paid, and when there is no card', () => {
    const paid = statement({});
    paid.cycle!.closedUnpaid = 0;
    paid.cycle!.overdue = false;
    expect(plain(billsReply([paid])).split('\n')[2]).toBe('Fechada: paga');
    expect(billsReply([])).toBe('Nenhum cartão de crédito no Hermes.');
  });
});

describe('/hoje', () => {
  it('lists what was spent today, with the total', () => {
    expect(
      plain(
        todayReply([
          {
            description: 'Padaria Real',
            amount: 23.9,
            at: new Date(2026, 9, 19, 12, 41),
          },
          { description: 'Uber', amount: 18, at: new Date(2026, 9, 19, 8, 5) },
        ]),
      ),
    ).toBe(
      [
        'Hoje:',
        '08:05 Uber · R$ 18,00',
        '12:41 Padaria Real · R$ 23,90',
        'Total: R$ 41,90',
      ].join('\n'),
    );
    expect(todayReply([])).toBe('Nenhum gasto registrado hoje.');
  });
});

describe('what the chat says back', () => {
  it('lists examples and the commands in the help', () => {
    expect(HELP_REPLY).toContain('uber 18 débito');
    expect(HELP_REPLY).toContain('/livre');
    expect(HELP_REPLY).toContain('/desfazer');
  });

  it('says what was missing from an entry', () => {
    expect(entryProblemReply('missing-amount')).toBe(
      'Não achei o valor. Mande numa linha, como "almoço 32,50", ou veja /ajuda.',
    );
    expect(entryProblemReply('missing-description')).toBe(
      'Faltou dizer o que foi. Mande numa linha, como "almoço 32,50".',
    );
    expect(entryProblemReply('no-account')).toBe(
      'Crie uma conta no Hermes para registrar pelo chat.',
    );
  });

  it('asks before undoing the last entry', () => {
    const message = undoQuestion({
      captureId: CAPTURE,
      description: 'Padaria Real',
      amount: 23.9,
      when: 'hoje 12:41',
    });

    expect(plain(message.text)).toBe(
      'Desfazer o último registro?\nPadaria Real · R$ 23,90 · hoje 12:41',
    );
    expect(
      message.buttons!.flat().map((button) => decodeChatAction(button.data)),
    ).toEqual([
      { kind: 'undo', captureId: CAPTURE },
      { kind: 'keep', captureId: CAPTURE },
    ]);
  });
});
