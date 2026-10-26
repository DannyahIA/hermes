import { describe, expect, it } from 'vitest';

import { buildBudgetRows, installmentsLabel } from '@/app/accounts/budget-rows';
import { Budget } from '@/core/entities/budget';
import type { BudgetProgress } from '@/modules/budgets/application/get-budget-progress.use-case';

const TODAY = new Date(2026, 9, 10, 12);

function progress(
  id: string,
  spent: number,
  amount: number,
  fixed?: [Date, Date],
): BudgetProgress {
  const budget = new Budget({
    id,
    userId: 'u1',
    categoryId: `cat-${id}`,
    amount,
    currency: 'BRL',
    kind: fixed ? 'fixed' : 'monthly',
    limits: [],
    periodStart: fixed?.[0] ?? new Date(2026, 0, 1),
    periodEnd: fixed?.[1] ?? null,
    createdAt: new Date(2026, 0, 1),
    updatedAt: new Date(2026, 0, 1),
  });
  return {
    budget,
    period: budget.periodFor(TODAY),
    amount: budget.amountFor(TODAY),
    running: budget.runsOn(TODAY),
    spent,
    remaining: amount - spent,
    percentage: spent / amount,
  };
}

const categories = new Map([
  ['cat-mercado', { name: 'Mercado', color: '#10b981' }],
  ['cat-lazer', { name: 'Lazer', color: '#3b82f6' }],
  ['cat-viagem', { name: 'Viagem', color: '#f59e0b' }],
]);

describe('buildBudgetRows', () => {
  it('formats the labels on the server and projects the day it blows', () => {
    const { running } = buildBudgetRows(
      [progress('mercado', 400, 500)],
      categories,
      TODAY,
    );

    expect(running).toEqual([
      {
        budgetId: 'mercado',
        name: 'Mercado',
        color: '#10b981',
        kindLabel: 'Todo mês',
        spent: 400,
        amount: 500,
        currency: 'BRL',
        status: 'ahead',
        limitDay: '13',
      },
    ]);
  });

  it('says "Até dd/mm" for a fixed budget that is running', () => {
    const { running } = buildBudgetRows(
      [
        progress('viagem', 100, 900, [
          new Date(2026, 9, 1),
          new Date(2026, 10, 5),
        ]),
      ],
      categories,
      TODAY,
    );

    expect(running[0]?.kindLabel).toBe('Até 05/11');
  });

  it('leads with the blown and the ahead of pace, and tucks the ended ones away', () => {
    const { running, ended } = buildBudgetRows(
      [
        progress('lazer', 50, 500),
        progress('mercado', 400, 500),
        progress('viagem', 700, 600),
        progress('antigo', 80, 100, [
          new Date(2026, 7, 1),
          new Date(2026, 7, 31),
        ]),
      ],
      new Map([
        ...categories,
        ['cat-antigo', { name: 'Antigo', color: '#999999' }],
      ]),
      TODAY,
    );

    expect(running.map((row) => row.budgetId)).toEqual([
      'viagem',
      'mercado',
      'lazer',
    ]);
    expect(running.map((row) => row.status)).toEqual([
      'over',
      'ahead',
      'on-pace',
    ]);
    expect(ended).toEqual([
      expect.objectContaining({
        budgetId: 'antigo',
        status: 'ended',
        kindLabel: 'Encerrado',
        limitDay: undefined,
      }),
    ]);
  });

  it('gives no projected day once the limit is blown or nothing was spent', () => {
    const { running } = buildBudgetRows(
      [progress('mercado', 700, 500), progress('lazer', 0, 500)],
      categories,
      TODAY,
    );

    expect(running.map((row) => row.limitDay)).toEqual([undefined, undefined]);
  });

  it('names a category that no longer exists', () => {
    const { running } = buildBudgetRows(
      [progress('orfao', 10, 500)],
      new Map(),
      TODAY,
    );

    expect(running[0]?.name).toBe('Categoria removida');
  });
});

describe('buildBudgetRows at the limit', () => {
  it('counts a budget at exactly 100% as over, sorted with the blown ones', () => {
    const { running } = buildBudgetRows(
      [
        progress('mercado', 400, 500),
        progress('lazer', 500, 500),
        progress('viagem', 700, 600),
      ],
      categories,
      TODAY,
    );

    expect(running.map((row) => [row.budgetId, row.status])).toEqual([
      ['viagem', 'over'],
      ['lazer', 'over'],
      ['mercado', 'ahead'],
    ]);
    expect(running[1]?.limitDay).toBeUndefined();
  });
});

describe('installmentsLabel', () => {
  it('names the month and the sum, only above zero', () => {
    expect(installmentsLabel(320, new Date(2026, 10, 3))).toBe(
      'Parcelas de novembro: R$\u00a0320,00',
    );
    expect(installmentsLabel(0, TODAY)).toBeUndefined();
  });
});
