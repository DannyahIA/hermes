import { describe, expect, it } from 'vitest';

import {
  BETWEEN_ACCOUNTS,
  groupListedTransactions,
} from './group-listed-transactions';
import type { ListedTransaction } from './listed-transaction';

function row(
  id: string,
  day: string,
  overrides: Partial<ListedTransaction> = {},
): ListedTransaction {
  return {
    id,
    description: id,
    amount: 10,
    type: 'expense',
    accountId: 'checking-1',
    categoryId: null,
    settlesAccountId: null,
    installmentPlanId: null,
    recurringRuleId: null,
    day,
    time: null,
    ...overrides,
  };
}

const TODAY = '2026-10-19';
const CATEGORIES = new Map([
  ['mercado', { name: 'Mercado', color: '#16a34a' }],
  ['lazer', { name: 'Lazer', color: '#7c3aed' }],
  ['salario', { name: 'Salário' }],
]);

describe('groupListedTransactions', () => {
  it('puts each row under its day, in the order the rows come, with the day total', () => {
    const groups = groupListedTransactions(
      [
        row('a', '2026-10-19'),
        row('b', '2026-10-18'),
        row('c', '2026-10-18'),
        row('d', '2026-10-13'),
      ],
      'day',
      { '2026-10-19': -10, '2026-10-18': -55.5 },
      TODAY,
      CATEGORIES,
    );

    expect(
      groups.map(({ key, label, total, rows }) => ({
        key,
        label,
        total,
        ids: rows.map((r) => r.id),
      })),
    ).toEqual([
      { key: '2026-10-19', label: 'Hoje', total: -10, ids: ['a'] },
      { key: '2026-10-18', label: 'Ontem', total: -55.5, ids: ['b', 'c'] },
      {
        key: '2026-10-13',
        label: 'ter., 13 de out.',
        total: undefined,
        ids: ['d'],
      },
    ]);
  });

  it('names months', () => {
    const groups = groupListedTransactions(
      [row('a', '2026-10-02'), row('b', '2026-09-30')],
      'month',
      {},
      TODAY,
      CATEGORIES,
    );
    expect(groups.map((group) => group.label)).toEqual([
      'Outubro de 2026',
      'Setembro de 2026',
    ]);
  });

  it('orders categories by how much moved, then the uncategorized, then what moved between accounts', () => {
    const groups = groupListedTransactions(
      [
        row('transfer', '2026-10-19', { type: 'transfer' }),
        row('open', '2026-10-19'),
        row('cinema', '2026-10-18', { categoryId: 'lazer' }),
        row('bill', '2026-10-18', { settlesAccountId: 'card-1' }),
        row('market', '2026-10-17', { categoryId: 'mercado' }),
        row('salary', '2026-10-05', {
          type: 'income',
          categoryId: 'salario',
        }),
      ],
      'category',
      { lazer: -80, mercado: -450.9, salario: 5000, none: -10 },
      TODAY,
      CATEGORIES,
    );

    expect(
      groups.map(({ key, label, color, rows }) => [
        key,
        label,
        color,
        rows.map((r) => r.id),
      ]),
    ).toEqual([
      ['salario', 'Salário', undefined, ['salary']],
      ['mercado', 'Mercado', '#16a34a', ['market']],
      ['lazer', 'Lazer', '#7c3aed', ['cinema']],
      ['none', 'Sem categoria', undefined, ['open']],
      [
        BETWEEN_ACCOUNTS,
        'Transferências e faturas',
        undefined,
        ['transfer', 'bill'],
      ],
    ]);
  });

  it('still lists a row filed under a category that is gone', () => {
    const [group] = groupListedTransactions(
      [row('a', '2026-10-19', { categoryId: 'apagada' })],
      'category',
      {},
      TODAY,
      CATEGORIES,
    );
    expect(group.label).toBe('Categoria removida');
  });
});
