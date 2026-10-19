import { describe, expect, it } from 'vitest';

import { splitOrigin } from './transaction-origin';

describe('splitOrigin', () => {
  it('reads an installment as its name and the mark "Parcela n/N"', () => {
    expect(
      splitOrigin({
        description: 'Geladeira (4/10)',
        installmentPlanId: 'plan-1',
      }),
    ).toEqual({ description: 'Geladeira', origin: 'Parcela 4/10' });
  });

  it('marks what a recurrence wrote', () => {
    expect(
      splitOrigin({ description: 'Aluguel', recurringRuleId: 'rule-1' }),
    ).toEqual({ description: 'Aluguel', origin: 'Recorrente' });
  });

  it('keeps a fraction someone typed, outside an installment plan', () => {
    expect(splitOrigin({ description: 'Rateio (1/3)' })).toEqual({
      description: 'Rateio (1/3)',
    });
  });
});
