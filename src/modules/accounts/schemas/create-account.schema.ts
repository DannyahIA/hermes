import { z } from 'zod';

import { ACCOUNT_TYPES, DEFAULT_CURRENCY } from '@/config/constants';

export const createAccountSchema = z.object({
  name: z.string().trim().min(1, 'Informe um nome para a conta.').max(255),
  type: z.enum(ACCOUNT_TYPES, {
    message: 'Selecione um tipo de conta válido.',
  }),
  balance: z.coerce
    .number()
    .finite('Informe um saldo inicial válido.')
    .default(0),
  currency: z
    .string()
    .trim()
    .length(3, 'A moeda deve ter 3 letras (ex: BRL).')
    .default(DEFAULT_CURRENCY),
  closingDay: z.coerce
    .number()
    .int()
    .min(1)
    .max(28, 'O dia deve ser entre 1 e 28.')
    .optional(),
  dueDay: z.coerce
    .number()
    .int()
    .min(1)
    .max(28, 'O dia deve ser entre 1 e 28.')
    .optional(),
});

export type CreateAccountSchema = z.infer<typeof createAccountSchema>;
