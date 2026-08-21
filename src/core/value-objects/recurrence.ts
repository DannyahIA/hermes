import type { DayRuleKind } from '@/core/entities/recurring-transaction';

export interface DayRule {
  dayRuleKind: DayRuleKind;
  dayRuleDay?: number;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Where a rule lands within a given month. `year`/`month` use JS's native
 * 0-indexed month (0 = January). "Business day" here means "not a weekend"
 * only — there's no holiday calendar in v1, so a rule can still land on a
 * public holiday. Documented as a known limitation, not a bug.
 */
export function resolveOccurrenceDate(
  year: number,
  month: number,
  rule: DayRule,
): Date {
  if (rule.dayRuleKind === 'fixed_day') {
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const day = Math.min(rule.dayRuleDay ?? 1, lastDayOfMonth);
    return new Date(year, month, day);
  }

  if (rule.dayRuleKind === 'first_business_day') {
    const date = new Date(year, month, 1);
    while (isWeekend(date)) date.setDate(date.getDate() + 1);
    return date;
  }

  // last_business_day
  const date = new Date(year, month + 1, 0);
  while (isWeekend(date)) date.setDate(date.getDate() - 1);
  return date;
}

export interface RecurrenceSchedule extends DayRule {
  startDate: Date;
  endDate?: Date;
  lastGeneratedThrough?: Date;
}

/**
 * Every occurrence date this rule owes but hasn't materialized yet, up
 * through (and including) `through`. Resuming from `lastGeneratedThrough`
 * (the month after it) makes this idempotent — calling it again with the
 * same `through` after the caller has recorded the new
 * `lastGeneratedThrough` returns nothing, so `GenerateDueOccurrencesUseCase`
 * never double-posts a month.
 */
export function occurrencesToGenerate(
  rule: RecurrenceSchedule,
  through: Date,
): Date[] {
  const occurrences: Date[] = [];

  let cursorYear: number;
  let cursorMonth: number;

  if (rule.lastGeneratedThrough) {
    cursorYear = rule.lastGeneratedThrough.getFullYear();
    cursorMonth = rule.lastGeneratedThrough.getMonth() + 1;
  } else {
    cursorYear = rule.startDate.getFullYear();
    cursorMonth = rule.startDate.getMonth();
  }
  if (cursorMonth > 11) {
    cursorMonth = 0;
    cursorYear += 1;
  }

  // A rule can run at most a few thousand months in any realistic use —
  // this cap just guarantees the loop can never spin forever.
  for (let guard = 0; guard < 1200; guard += 1) {
    const candidate = resolveOccurrenceDate(cursorYear, cursorMonth, rule);
    if (candidate > through) break;
    if (rule.endDate && candidate > rule.endDate) break;

    if (candidate >= rule.startDate) {
      occurrences.push(candidate);
    }

    cursorMonth += 1;
    if (cursorMonth > 11) {
      cursorMonth = 0;
      cursorYear += 1;
    }
  }

  return occurrences;
}
