import { z } from 'zod';

import { localDay } from '@/shared/lib/local-day';

export const createRecurringTransactionSchema = z.object({
  accountId: z.uuid('Selecione uma conta.'),
  categoryId: z
    .uuid('Categoria inválida.')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  description: z.string().trim().min(1, 'Informe uma descrição.').max(255),
  amount: z.coerce.number().positive('O valor deve ser maior que zero.'),
  type: z.enum(['income', 'expense'], { message: 'Selecione o tipo.' }),
  dayRuleKind: z.enum(
    ['fixed_day', 'first_business_day', 'last_business_day'],
    {
      message: 'Selecione a regra de repetição.',
    },
  ),
  dayRuleDay: z.coerce.number().int().min(1).max(31).optional(),
  startDate: z.preprocess(
    (value) => localDay(value, 'start'),
    z.coerce.date({ message: 'Informe uma data válida.' }).optional(),
  ),
  endDate: z.preprocess(
    (value) => localDay(value, 'end'),
    z.coerce.date({ message: 'Informe uma data válida.' }).optional(),
  ),
});

export type CreateRecurringTransactionSchema = z.infer<
  typeof createRecurringTransactionSchema
>;
