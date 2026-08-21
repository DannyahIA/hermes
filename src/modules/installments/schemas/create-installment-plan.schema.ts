import { z } from 'zod';

export const createInstallmentPlanSchema = z
  .object({
    accountId: z.uuid('Selecione uma conta.'),
    categoryId: z
      .uuid('Categoria inválida.')
      .optional()
      .or(z.literal('').transform(() => undefined)),
    description: z.string().trim().min(1, 'Informe uma descrição.').max(255),
    totalAmount: z.coerce
      .number()
      .positive('O valor deve ser maior que zero.')
      .optional(),
    installmentAmount: z.coerce
      .number()
      .positive('O valor deve ser maior que zero.')
      .optional(),
    installmentCount: z.coerce
      .number()
      .int()
      .min(2, 'Um parcelamento precisa de pelo menos 2 parcelas.')
      .max(60, 'Máximo de 60 parcelas.'),
    startDate: z.coerce.date().optional(),
  })
  .refine(
    (data) =>
      (data.totalAmount !== undefined) !==
      (data.installmentAmount !== undefined),
    {
      message: 'Informe o valor total ou o valor da parcela — não os dois.',
      path: ['totalAmount'],
    },
  );

export type CreateInstallmentPlanSchema = z.infer<
  typeof createInstallmentPlanSchema
>;
