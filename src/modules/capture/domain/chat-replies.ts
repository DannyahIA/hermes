import type { ChatMessage } from '@/core/contracts/chat-channel';
import type { AvailableToSpend } from '@/modules/dashboard/application/metrics/calculate-available-to-spend';
import type { CardStatement } from '@/modules/dashboard/application/metrics/calculate-card-statements';
import { formatCurrency } from '@/shared/lib/format-currency';

import { encodeChatAction } from './chat-action';
import { CHAT_COMMANDS } from './chat-command';
import type { QuickEntryIssue } from './parse-quick-entry';
import { freeLine } from './spending-lines';

const dayMonth = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
});
const time = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
});

/** Spec 2026-10-17-telegram-apple-pay-design.md §5.5 and §5.6. */
export const HELP_REPLY = [
  'Mande um gasto numa linha, como:',
  '• almoço 32,50',
  '• uber 18 débito',
  '• mercado 250,40 ontem',
  '• farmácia 89,90 itaú',
  '• +3000 salário (uma entrada)',
  'Acima de R$ 500 eu confirmo antes de salvar.',
  '',
  'Comandos:',
  ...CHAT_COMMANDS.map(
    (command) => `/${command.name}: ${command.description.toLowerCase()}`,
  ),
].join('\n');

/** For /livre and /fatura when the user keeps balances out of the chat (D5). */
export const PRIVATE_REPLY =
  'Você pediu para não mandar saldos aqui. Veja no app, ou ligue em Configurações › Telegram.';

/** /livre: the Início's headline, and what it is made of. */
export function freeReply(available: AvailableToSpend | null): string {
  const headline = freeLine(available);
  if (!available || !headline) {
    return 'Sem conta corrente no Hermes, não dá para calcular quanto está livre.';
  }
  return [
    headline,
    `Em conta corrente: ${formatCurrency(available.inChecking)}`,
    `Nos cartões: ${formatCurrency(available.owedOnCards)}`,
    `Já agendado até lá: ${formatCurrency(available.scheduled)}`,
  ].join('\n');
}

function statementLines(statement: CardStatement): string[] {
  const { cycle } = statement;
  if (!cycle) {
    return [
      statement.name,
      `Devendo ${formatCurrency(statement.owed)}. Cadastre o fechamento e o vencimento no app para ver as faturas.`,
    ];
  }
  const closed =
    cycle.closedUnpaid > 0
      ? `Fechada: ${formatCurrency(cycle.closedUnpaid)} · ${cycle.overdue ? 'venceu' : 'vence'} ${dayMonth.format(cycle.closedDueOn)}`
      : 'Fechada: paga';
  return [
    statement.name,
    `Aberta: ${formatCurrency(cycle.open)} · fecha ${dayMonth.format(cycle.nextClosing)} · vence ${dayMonth.format(cycle.openDueOn)}`,
    closed,
  ];
}

/** /fatura: each card's open statement and what is left of the closed one. */
export function billsReply(statements: CardStatement[]): string {
  if (statements.length === 0) return 'Nenhum cartão de crédito no Hermes.';
  return statements
    .map((statement) => statementLines(statement).join('\n'))
    .join('\n\n');
}

/** /hoje: today's spending, in the order it happened, and its total. */
export function todayReply(
  spent: Array<{ description: string; amount: number; at: Date }>,
): string {
  if (spent.length === 0) return 'Nenhum gasto registrado hoje.';
  const lines = [...spent]
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map(
      (item) =>
        `${time.format(item.at)} ${item.description} · ${formatCurrency(item.amount)}`,
    );
  const total = spent.reduce((sum, item) => sum + item.amount, 0);
  return ['Hoje:', ...lines, `Total: ${formatCurrency(total)}`].join('\n');
}

/** What a line was missing to become an entry. */
export function entryProblemReply(
  code: Exclude<QuickEntryIssue['code'], 'several-amounts'>,
): string {
  switch (code) {
    case 'missing-amount':
      return 'Não achei o valor. Mande numa linha, como "almoço 32,50", ou veja /ajuda.';
    case 'missing-description':
      return 'Faltou dizer o que foi. Mande numa linha, como "almoço 32,50".';
    case 'no-account':
      return 'Crie uma conta no Hermes para registrar pelo chat.';
  }
}

/** /desfazer asks first: it may not be the entry the person has in mind. */
export function undoQuestion(last: {
  captureId: string;
  description: string;
  amount: number;
  when: string;
}): ChatMessage {
  return {
    text: [
      'Desfazer o último registro?',
      `${last.description} · ${formatCurrency(last.amount)} · ${last.when}`,
    ].join('\n'),
    buttons: [
      [
        {
          text: 'Desfazer',
          data: encodeChatAction({ kind: 'undo', captureId: last.captureId }),
        },
        {
          text: 'Manter',
          data: encodeChatAction({ kind: 'keep', captureId: last.captureId }),
        },
      ],
    ],
  };
}
