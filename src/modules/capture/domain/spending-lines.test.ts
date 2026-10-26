import { describe, expect, it } from 'vitest';

import type { AvailableToSpend } from '@/modules/dashboard/application/metrics/calculate-available-to-spend';

import { freeLine } from './spending-lines';

const plain = (text: string | undefined) => text?.replace(/ /g, ' ');

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

describe('freeLine', () => {
  it('says what is free until the next income, and per day', () => {
    expect(plain(freeLine(available))).toBe(
      'Livre até 05/11: R$ 1.818,20 (R$ 101 por dia)',
    );
    expect(
      plain(freeLine({ ...available, horizonKind: 'month-end', perDay: null })),
    ).toBe('Livre até o fim do mês: R$ 1.818,20');
  });

  it('says what is missing when cards and bills take more than there is', () => {
    expect(plain(freeLine({ ...available, free: -120, perDay: null }))).toBe(
      'Faltam R$ 120,00 para cobrir cartões e contas até 05/11.',
    );
  });

  it('has nothing to say without a checking account', () => {
    expect(freeLine(null)).toBeUndefined();
  });
});
