import { z } from 'zod';

import { DEFAULT_CURRENCY } from '@/config/constants';
import { localDay } from '@/shared/lib/local-day';

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
    periodStart: z.preprocess(
      (value) => localDay(value, 'start'),
      z.coerce.date({ message: 'Informe uma data de início válida.' }),
    ),
    periodEnd: z.preprocess(
      (value) => localDay(value, 'end'),
      z.coerce.date({ message: 'Informe uma data de término válida.' }),
    ),
  })
  .refine((data) => data.periodEnd >= data.periodStart, {
    message: 'A data de término não pode ser anterior à data de início.',
    path: ['periodEnd'],
  });

export type CreateBudgetSchema = z.infer<typeof createBudgetSchema>;
