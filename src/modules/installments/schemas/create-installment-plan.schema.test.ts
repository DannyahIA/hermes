import { describe, expect, it } from 'vitest';

import { createInstallmentPlanSchema } from '@/modules/installments/schemas/create-installment-plan.schema';

describe('createInstallmentPlanSchema', () => {
  const base = {
    accountId: '11111111-1111-4111-8111-111111111111',
    description: 'Compra',
    installmentCount: 3,
  };

  it('accepts totalAmount alone', () => {
    const result = createInstallmentPlanSchema.safeParse({
      ...base,
      totalAmount: '300',
    });
    expect(result.success).toBe(true);
  });

  it('accepts installmentAmount alone', () => {
    const result = createInstallmentPlanSchema.safeParse({
      ...base,
      installmentAmount: '100',
    });
    expect(result.success).toBe(true);
  });

  it('rejects when both are provided', () => {
    const result = createInstallmentPlanSchema.safeParse({
      ...base,
      totalAmount: '300',
      installmentAmount: '100',
    });
    expect(result.success).toBe(false);
  });

  it('rejects when neither is provided', () => {
    const result = createInstallmentPlanSchema.safeParse(base);
    expect(result.success).toBe(false);
  });
});
