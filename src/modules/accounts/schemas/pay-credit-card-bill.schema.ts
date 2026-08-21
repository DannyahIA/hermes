import { z } from 'zod';

export const payCreditCardBillSchema = z.object({
  creditAccountId: z.uuid('Selecione o cartão de crédito.'),
  payingAccountId: z.uuid('Selecione a conta de pagamento.'),
  amount: z.coerce.number().positive('O valor deve ser maior que zero.'),
  description: z.string().trim().max(255).optional(),
});

export type PayCreditCardBillSchema = z.infer<typeof payCreditCardBillSchema>;
