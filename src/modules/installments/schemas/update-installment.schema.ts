import { z } from 'zod';

export const updateInstallmentSchema = z.object({
  id: z.uuid(),
  description: z.string().trim().min(1).max(255).optional(),
  amount: z.coerce
    .number()
    .positive('O valor deve ser maior que zero.')
    .optional(),
  categoryId: z
    .uuid()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  occurredAt: z.coerce.date().optional(),
  propagateToFuture: z.coerce.boolean().default(false),
});

export type UpdateInstallmentSchema = z.infer<typeof updateInstallmentSchema>;
