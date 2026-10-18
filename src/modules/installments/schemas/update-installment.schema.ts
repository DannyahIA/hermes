import { z } from 'zod';

import { localDay } from '@/shared/lib/local-day';

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
  occurredAt: z.preprocess(
    (value) => localDay(value, 'start'),
    z.coerce.date({ message: 'Informe uma data válida.' }).optional(),
  ),
  propagateToFuture: z.coerce.boolean().default(false),
});

export type UpdateInstallmentSchema = z.infer<typeof updateInstallmentSchema>;
