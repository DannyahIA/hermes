import { describe, expect, it } from 'vitest';

import { DateRange } from '@/core/value-objects/date-range';
import { formatCurrency } from '@/shared/lib/format-currency';

import {
  budgetAlertFor,
  type BudgetAlertStage,
  projectedLimitDay,
} from './budget-alerts';

const october = DateRange.monthOf(new Date(2026, 9, 1));
const brl = formatCurrency;

function alertFor(spent: number, day: number, warned: BudgetAlertStage[]) {
  return budgetAlertFor({
    categoryName: 'Mercado',
    amount: 500,
    spent,
    period: october,
    today: new Date(2026, 9, day, 14, 30),
    warned: new Set(warned),
  });
}

describe('budgetAlertFor', () => {
  it.each<{
    name: string;
    spent: number;
    day: number;
    warned: BudgetAlertStage[];
    text: string | null;
    claims: BudgetAlertStage[];
  }>([
    {
      name: 'stays quiet below the first stage and on pace',
      spent: 370,
      day: 20,
      warned: [],
      text: null,
      claims: [],
    },
    {
      name: 'warns at 75% and, being ahead of pace, says when it runs out',
      spent: 375,
      day: 20,
      warned: [],
      text: `Mercado: 75% do orçamento (${brl(375)} de ${brl(500)}). No ritmo de hoje, passa do limite dia 27.`,
      claims: ['75', 'pace'],
    },
    {
      name: 'reaching the limit claims every stage still unwarned, with no pace line',
      spent: 500,
      day: 20,
      warned: ['75'],
      text: `Mercado: chegou no limite do orçamento (${brl(500)}).`,
      claims: ['90', '95', '100', 'pace'],
    },
    {
      name: 'claims only the stage when the lower ones and pace were already told',
      spent: 480,
      day: 25,
      warned: ['75', '90', 'pace'],
      text: `Mercado: 95% do orçamento (${brl(480)} de ${brl(500)}). No ritmo de hoje, passa do limite dia 27.`,
      claims: ['95'],
    },
    {
      name: 'tells every purchase over the limit and claims nothing left',
      spent: 542,
      day: 28,
      warned: ['75', '90', '95', '100', 'pace'],
      text: `Mercado: ${brl(42)} acima do orçamento de ${brl(500)}.`,
      claims: [],
    },
    {
      name: 'warns on pace when half is gone before half the period',
      spent: 250,
      day: 10,
      warned: [],
      text: `Mercado: metade do orçamento em 10 dias. No ritmo de hoje, passa do limite dia 20. Hora de segurar um pouco.`,
      claims: ['pace'],
    },
    {
      name: 'does not repeat the pace warning',
      spent: 250,
      day: 10,
      warned: ['pace'],
      text: null,
      claims: [],
    },
    {
      name: 'puts the projected day on a stage alert on day 10',
      spent: 400,
      day: 10,
      warned: [],
      text: `Mercado: 75% do orçamento (${brl(400)} de ${brl(500)}). No ritmo de hoje, passa do limite dia 13.`,
      claims: ['75', 'pace'],
    },
  ])('$name', ({ spent, day, warned, text, claims }) => {
    const alert = alertFor(spent, day, warned);

    if (text === null) {
      expect(alert).toBeNull();
      return;
    }
    expect(alert?.text).toBe(text);
    expect(alert?.claims).toEqual(claims);
  });

  it('puts only the highest stage reached in the text', () => {
    expect(alertFor(460, 31, [])?.text).toBe(
      `Mercado: 90% do orçamento (${brl(460)} de ${brl(500)}).`,
    );
    expect(alertFor(460, 31, [])?.claims).toEqual(['75', '90', 'pace']);
  });

  it('adds no pace line when spending keeps up with the calendar', () => {
    expect(alertFor(380, 31, [])?.text).toBe(
      `Mercado: 75% do orçamento (${brl(380)} de ${brl(500)}).`,
    );
  });

  it('says "no fim do período" when the limit lands on the last day', () => {
    const twoDays = new DateRange(
      new Date(2026, 9, 10),
      new Date(2026, 9, 11, 23, 59, 59, 999),
    );
    const alert = budgetAlertFor({
      categoryName: 'Mercado',
      amount: 500,
      spent: 400,
      period: twoDays,
      today: new Date(2026, 9, 10, 9),
      warned: new Set(),
    });
    expect(alert?.text).toBe(
      `Mercado: 75% do orçamento (${brl(400)} de ${brl(500)}). No ritmo de hoje, passa do limite no fim do período.`,
    );
  });

  it('says "1 dia", not "1 dias", when half the limit is gone on the first day', () => {
    expect(alertFor(250, 1, [])?.text).toBe(
      'Mercado: metade do orçamento em 1 dia. No ritmo de hoje, passa do limite dia 2. Hora de segurar um pouco.',
    );
  });

  it('does not warn again for a stage that was already told', () => {
    expect(alertFor(400, 31, ['75'])).toBeNull();
  });

  it('works on a period that is not a calendar month', () => {
    const period = new DateRange(
      new Date(2026, 9, 10),
      new Date(2026, 9, 19, 23, 59, 59, 999),
    );
    // 10-day period, 4 days gone: 0.4 elapsed. 250 spent is half.
    const alert = budgetAlertFor({
      categoryName: 'Lazer',
      amount: 500,
      spent: 250,
      period,
      today: new Date(2026, 9, 13),
      warned: new Set(),
    });
    expect(alert?.text).toBe(
      'Lazer: metade do orçamento em 4 dias. No ritmo de hoje, passa do limite dia 17. Hora de segurar um pouco.',
    );
  });
});

describe('projectedLimitDay', () => {
  it('is the day spending reaches the limit at the daily rate so far', () => {
    expect(projectedLimitDay(500, 250, october, new Date(2026, 9, 10))).toEqual(
      new Date(2026, 9, 20),
    );
  });

  it('is null when the limit falls after the period ends', () => {
    expect(
      projectedLimitDay(500, 100, october, new Date(2026, 9, 28)),
    ).toBeNull();
  });

  it('is null when nothing was spent', () => {
    expect(
      projectedLimitDay(500, 0, october, new Date(2026, 9, 10)),
    ).toBeNull();
  });
});
