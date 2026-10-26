import { z } from 'zod';

import { DEFAULT_CURRENCY } from '@/config/constants';
import { localDay } from '@/shared/lib/local-day';

/** An empty date field (the form leaves it out for a monthly budget) is no date. */
function optionalDay(edge: 'start' | 'end', message: string) {
  return z.preprocess(
    (value) =>
      value === '' || value === null ? undefined : localDay(value, edge),
    z.coerce.date({ message }).optional(),
  );
}

export const createBudgetSchema = z
  .object({
    categoryId: z.uuid('Selecione uma categoria válida.'),
    amount: z.coerce
      .number()
      .positive('Informe um valor de orçamento maior que zero.'),
    currency: z
      .string()
      .trim()
      .length(3, 'A moeda deve ter 3 letras (ex: BRL).')
      .default(DEFAULT_CURRENCY),
    kind: z.enum(['monthly', 'fixed']).default('monthly'),
    periodStart: optionalDay('start', 'Informe uma data de início válida.'),
    periodEnd: optionalDay('end', 'Informe uma data de término válida.'),
  })
  .superRefine((data, ctx) => {
    // A monthly budget starts this month and never ends: it takes no dates.
    if (data.kind !== 'fixed') return;
    if (!data.periodStart) {
      ctx.addIssue({
        code: 'custom',
        message: 'Informe uma data de início válida.',
        path: ['periodStart'],
      });
    }
    if (!data.periodEnd) {
      ctx.addIssue({
        code: 'custom',
        message: 'Informe uma data de término válida.',
        path: ['periodEnd'],
      });
    }
    if (
      data.periodStart &&
      data.periodEnd &&
      data.periodEnd < data.periodStart
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'A data de término não pode ser anterior à data de início.',
        path: ['periodEnd'],
      });
    }
  });

export type CreateBudgetSchema = z.infer<typeof createBudgetSchema>;
