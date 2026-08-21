import { z } from 'zod';

export const updateBudgetSchema = z
  .object({
    id: z.uuid('Orçamento inválido.'),
    amount: z.coerce
      .number()
      .positive('Informe um valor de orçamento maior que zero.')
      .optional(),
    currency: z
      .string()
      .trim()
      .length(3, 'A moeda deve ter 3 letras (ex: BRL).')
      .optional(),
    periodStart: z.coerce
      .date({ message: 'Informe uma data de início válida.' })
      .optional(),
    periodEnd: z.coerce
      .date({ message: 'Informe uma data de término válida.' })
      .optional(),
  })
  .refine(
    (data) =>
      !data.periodStart ||
      !data.periodEnd ||
      data.periodEnd >= data.periodStart,
    {
      message: 'A data de término não pode ser anterior à data de início.',
      path: ['periodEnd'],
    },
  );

export type UpdateBudgetSchema = z.infer<typeof updateBudgetSchema>;
