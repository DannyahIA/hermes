import { z } from 'zod';

import { localDay } from '@/shared/lib/local-day';

export const transferMoneySchema = z
  .object({
    fromAccountId: z.uuid('Selecione a conta de origem.'),
    toAccountId: z.uuid('Selecione a conta de destino.'),
    amount: z.coerce.number().positive('O valor deve ser maior que zero.'),
    description: z.string().trim().min(1, 'Informe uma descrição.').max(255),
    occurredAt: z.preprocess(
      (value) => localDay(value, 'start'),
      z.coerce.date({ message: 'Informe uma data válida.' }).optional(),
    ),
  })
  .refine((data) => data.fromAccountId !== data.toAccountId, {
    message: 'Selecione contas diferentes para a transferência.',
    path: ['toAccountId'],
  });

export type TransferMoneySchema = z.infer<typeof transferMoneySchema>;
