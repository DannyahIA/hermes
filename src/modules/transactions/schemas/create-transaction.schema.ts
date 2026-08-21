import { z } from 'zod';

export const createTransactionSchema = z.object({
  accountId: z.uuid('Selecione uma conta.'),
  categoryId: z
    .uuid('Categoria inválida.')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  description: z.string().trim().min(1, 'Informe uma descrição.').max(255),
  amount: z.coerce.number().positive('O valor deve ser maior que zero.'),
  type: z.enum(['income', 'expense'], {
    message: 'Selecione o tipo da transação.',
  }),
  occurredAt: z.coerce.date().optional(),
});

export type CreateTransactionSchema = z.infer<typeof createTransactionSchema>;
