import { describe, expect, it } from 'vitest';

import { Budget } from '@/core/entities/budget';

import { calculateBudgetPace } from './calculate-budget-pace';

const TODAY = new Date(2026, 9, 17, 15, 30);

function progress(
  id: string,
  spent: number,
  amount: number,
  period: [Date, Date] = [
    new Date(2026, 9, 1),
    new Date(2026, 9, 31, 23, 59, 59),
  ],
) {
  const budget = new Budget({
    id,
    userId: 'u1',
    categoryId: `cat-${id}`,
    amount,
    currency: 'BRL',
    kind: 'fixed',
    limits: [],
    periodStart: period[0],
    periodEnd: period[1],
    createdAt: new Date(),
    updatedAt: new Date(),
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

describe('calculateBudgetPace', () => {
  it('measures spending against how much of the month has gone by', () => {
    const [pace] = calculateBudgetPace([progress('mercado', 600, 1200)], TODAY);

    expect(pace.elapsedShare).toBeCloseTo(17 / 31);
    expect(pace).toMatchObject({ spentShare: 0.5, status: 'on-pace' });
  });

  it('allows ten points ahead of the calendar before calling it ahead of pace', () => {
    const elapsed = 17 / 31;
    const [onPace, ahead] = [
      progress('a', (elapsed + 0.09) * 1000, 1000),
      progress('b', (elapsed + 0.11) * 1000, 1000),
    ].map((p) => calculateBudgetPace([p], TODAY)[0].status);

    expect(onPace).toBe('on-pace');
    expect(ahead).toBe('ahead');
  });

  it('calls a budget over once spending passes the limit', () => {
    const [pace] = calculateBudgetPace([progress('lazer', 330, 300)], TODAY);
    expect(pace).toMatchObject({ status: 'over', spentShare: 1.1 });
  });

  it('puts blown budgets first, then the ones ahead of pace, then by share spent', () => {
    const order = calculateBudgetPace(
      [
        progress('low', 100, 1000),
        progress('ahead', 900, 1000),
        progress('over', 1100, 1000),
        progress('mid', 400, 1000),
      ],
      TODAY,
    ).map((pace) => pace.budgetId);

    expect(order).toEqual(['over', 'ahead', 'mid', 'low']);
  });

  it('leaves out budgets whose period is not running today', () => {
    const paces = calculateBudgetPace(
      [
        progress('september', 100, 1000, [
          new Date(2026, 8, 1),
          new Date(2026, 8, 30, 23, 59, 59),
        ]),
        progress('october', 100, 1000),
      ],
      TODAY,
    );

    expect(paces.map((pace) => pace.budgetId)).toEqual(['october']);
  });

  it('is fully elapsed on the last day of the period', () => {
    const [pace] = calculateBudgetPace(
      [progress('mercado', 100, 1000)],
      new Date(2026, 9, 31, 9),
    );
    expect(pace.elapsedShare).toBe(1);
  });

  it('paces a monthly budget over the month it is asked about', () => {
    const monthly = new Budget({
      id: 'monthly',
      userId: 'u1',
      categoryId: 'cat-monthly',
      amount: 1000,
      currency: 'BRL',
      kind: 'monthly',
      limits: [],
      periodStart: new Date(2026, 7, 1),
      periodEnd: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const [pace] = calculateBudgetPace(
      [
        {
          budget: monthly,
          period: monthly.periodFor(TODAY),
          amount: monthly.amountFor(TODAY),
          running: monthly.runsOn(TODAY),
          spent: 500,
          remaining: 500,
          percentage: 0.5,
        },
      ],
      TODAY,
    );

    expect(pace.periodStart).toEqual(new Date(2026, 9, 1));
    expect(pace.periodEnd).toEqual(new Date(2026, 9, 31, 23, 59, 59, 999));
    expect(pace.elapsedShare).toBeCloseTo(17 / 31);
  });
});
