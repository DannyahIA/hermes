import { ValidationError } from '@/core/errors/validation-error';

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Splits a total into `count` equal installments, rounded to cents. Any
 * rounding remainder lands on the last installment so the parts always sum
 * back to exactly `totalAmount` — used for interest-free purchase
 * installments.
 */
export function splitEvenly(totalAmount: number, count: number): number[] {
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    throw new ValidationError('Amount must be greater than zero.');
  }
  if (!Number.isInteger(count) || count < 1) {
    throw new ValidationError('Installment count must be a positive integer.');
  }

  const base = Math.floor((totalAmount / count) * 100) / 100;
  const amounts = Array<number>(count).fill(base);
  const remainder = round2(totalAmount - round2(base * count));
  amounts[count - 1] = round2(amounts[count - 1] + remainder);

  return amounts;
}

export interface AmortizationInstallment {
  number: number;
  amount: number;
  interestPortion: number;
  principalPortion: number;
  remainingBalance: number;
}

/**
 * The standard "Price" (French) amortization system: a fixed installment
 * amount for the life of the loan, with the interest/principal split
 * shifting each period as the balance shrinks. A `monthlyInterestRate` of 0
 * degrades to an even split (no interest).
 *
 * Nothing here is persisted — `modules/installments` stores only
 * `principal`/`interestRate`/`installmentCount` on the plan, and this
 * function is re-run whenever the breakdown needs to be displayed, so it
 * can never drift out of sync with the numbers it was derived from.
 */
export function calculatePriceInstallments(input: {
  principal: number;
  monthlyInterestRate: number;
  installmentCount: number;
}): AmortizationInstallment[] {
  const {
    principal,
    monthlyInterestRate: rate,
    installmentCount: count,
  } = input;

  if (!Number.isFinite(principal) || principal <= 0) {
    throw new ValidationError('Principal must be greater than zero.');
  }
  if (!Number.isInteger(count) || count < 1) {
    throw new ValidationError('Installment count must be a positive integer.');
  }
  if (!Number.isFinite(rate) || rate < 0) {
    throw new ValidationError('Interest rate must be zero or greater.');
  }

  const installmentAmount = round2(
    rate === 0
      ? principal / count
      : (principal * rate * (1 + rate) ** count) / ((1 + rate) ** count - 1),
  );

  const schedule: AmortizationInstallment[] = [];
  let remaining = principal;

  for (let number = 1; number <= count; number += 1) {
    const interestPortion = round2(remaining * rate);
    let principalPortion = round2(installmentAmount - interestPortion);
    let amount = installmentAmount;
    remaining = round2(remaining - principalPortion);

    const isLast = number === count;
    if (isLast) {
      // Absorb accumulated rounding drift so the schedule pays off the
      // principal exactly, instead of leaving a stray cent owed/overpaid.
      principalPortion = round2(principalPortion + remaining);
      amount = round2(interestPortion + principalPortion);
      remaining = 0;
    }

    schedule.push({
      number,
      amount,
      interestPortion,
      principalPortion,
      remainingBalance: Math.max(remaining, 0),
    });
  }

  return schedule;
}
