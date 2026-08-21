import { z } from 'zod';

export const updateRecurringTransactionSchema = z.object({
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
  dayRuleKind: z
    .enum(['fixed_day', 'first_business_day', 'last_business_day'])
    .optional(),
  dayRuleDay: z.coerce.number().int().min(1).max(31).optional(),
  active: z.coerce.boolean().optional(),
});

export type UpdateRecurringTransactionSchema = z.infer<
  typeof updateRecurringTransactionSchema
>;
