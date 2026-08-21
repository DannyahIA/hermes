import { z } from 'zod';

import { ACCOUNT_TYPES } from '@/config/constants';

export const updateAccountSchema = z.object({
  id: z.uuid('Conta inválida.'),
  name: z
    .string()
    .trim()
    .min(1, 'Informe um nome para a conta.')
    .max(255)
    .optional(),
  type: z.enum(ACCOUNT_TYPES).optional(),
  currency: z.string().trim().length(3).optional(),
  closingDay: z.coerce.number().int().min(1).max(28).optional(),
  dueDay: z.coerce.number().int().min(1).max(28).optional(),
});

export type UpdateAccountSchema = z.infer<typeof updateAccountSchema>;
