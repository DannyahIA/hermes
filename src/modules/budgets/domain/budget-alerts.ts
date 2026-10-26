import type { DateRange } from '@/core/value-objects/date-range';
import { formatCurrency } from '@/shared/lib/format-currency';

import { elapsedShareOf, isAheadOfPace } from './budget-pace';

export type BudgetAlertStage = '75' | '90' | '95' | '100' | 'pace';

export interface BudgetAlertInput {
  categoryName: string;
  /** The period's limit. */
  amount: number;
  /** Spent in the period, this purchase included. */
  spent: number;
  period: DateRange;
  today: Date;
  warned: ReadonlySet<BudgetAlertStage>;
}

export interface BudgetAlert {
  text: string;
  /** Stages this alert uses up; empty for "over", which tells every purchase. */
  claims: BudgetAlertStage[];
}

type SpendStage = Exclude<BudgetAlertStage, 'pace'>;

/** Lowest first; each is the share of the limit that triggers it. */
const STAGES: ReadonlyArray<readonly [SpendStage, number]> = [
  ['75', 0.75],
  ['90', 0.9],
  ['95', 0.95],
  ['100', 1],
];

/** Half the budget gone before half the period is the early warning. */
const PACE_SPENT_SHARE = 0.5;
const PACE_ELAPSED_SHARE = 0.5;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * The day spending reaches the limit at today's daily rate, or null if that
 * is not within the period (or nothing has been spent yet).
 */
export function projectedLimitDay(
  amount: number,
  spent: number,
  period: DateRange,
  today: Date,
): Date | null {
  const daysGone = period.daysGoneBy(today);
  if (spent <= 0 || amount <= 0 || daysGone <= 0) return null;

  const rate = spent / daysGone;
  const daysToLimit = Math.ceil(amount / rate);
  if (daysToLimit > period.lengthInDays) return null;

  const start = startOfDay(period.start);
  return new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + daysToLimit - 1,
  );
}

function projectionPhrase(limitDay: Date, period: DateRange): string {
  const isLastDay =
    startOfDay(limitDay).getTime() === startOfDay(period.end).getTime();
  return `No ritmo de hoje, passa do limite ${
    isLastDay ? 'no fim do período' : `dia ${limitDay.getDate()}`
  }.`;
}

function notWarned(
  stages: BudgetAlertStage[],
  warned: ReadonlySet<BudgetAlertStage>,
): BudgetAlertStage[] {
  return stages.filter((stage) => !warned.has(stage));
}

/**
 * What to tell about a budget after a purchase, if anything: one alert per
 * budget per purchase. Over the limit wins, then the highest stage reached
 * that hasn't been told yet, then the early pace warning.
 */
export function budgetAlertFor(input: BudgetAlertInput): BudgetAlert | null {
  const { categoryName, amount, spent, period, today, warned } = input;
  if (amount <= 0) return null;

  const allStages = STAGES.map(([stage]) => stage);

  if (spent > amount) {
    return {
      text: `${categoryName}: ${formatCurrency(spent - amount)} acima do orçamento de ${formatCurrency(amount)}.`,
      claims: notWarned([...allStages, 'pace'], warned),
    };
  }

  const spentShare = spent / amount;
  const elapsedShare = elapsedShareOf(period, today);
  const limitDay = projectedLimitDay(amount, spent, period, today);

  const reached = STAGES.filter(
    ([stage, share]) => spentShare >= share && !warned.has(stage),
  ).at(-1);

  if (reached) {
    const [stage] = reached;
    const head =
      stage === '100'
        ? `${categoryName}: chegou no limite do orçamento (${formatCurrency(amount)}).`
        : `${categoryName}: ${stage}% do orçamento (${formatCurrency(spent)} de ${formatCurrency(amount)}).`;
    const pace =
      stage !== '100' && limitDay && isAheadOfPace(spentShare, elapsedShare)
        ? ` ${projectionPhrase(limitDay, period)}`
        : '';
    const upTo = allStages.slice(0, allStages.indexOf(stage) + 1);

    return {
      text: `${head}${pace}`,
      claims: notWarned([...upTo, 'pace'], warned),
    };
  }

  if (
    limitDay &&
    spentShare >= PACE_SPENT_SHARE &&
    elapsedShare < PACE_ELAPSED_SHARE &&
    !warned.has('pace')
  ) {
    const daysGone = period.daysGoneBy(today);
    return {
      text: `${categoryName}: metade do orçamento em ${daysGone} ${daysGone === 1 ? 'dia' : 'dias'}. ${projectionPhrase(limitDay, period)} Hora de segurar um pouco.`,
      claims: ['pace'],
    };
  }

  return null;
}
