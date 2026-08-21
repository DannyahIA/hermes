import { z } from 'zod';

export const createLoanSchema = z.object({
  description: z.string().trim().min(1, 'Informe uma descrição.').max(255),
  principal: z.coerce.number().positive('O valor deve ser maior que zero.'),
  // The form collects this as a percentage (e.g. "2" meaning 2% a.m.) — divide
  // by 100 here, once, so every consumer downstream always sees a decimal
  // monthly rate (0.02). Never re-apply this conversion elsewhere.
  monthlyInterestRate: z.coerce
    .number()
    .min(0, 'A taxa de juros não pode ser negativa.')
    .transform((percentage) => percentage / 100),
  installmentCount: z.coerce
    .number()
    .int()
    .min(2, 'Um empréstimo precisa de pelo menos 2 parcelas.')
    .max(60, 'Máximo de 60 parcelas.'),
  disbursementAccountId: z.uuid('Selecione a conta de recebimento.'),
  repaymentAccountId: z.uuid('Selecione a conta de pagamento.'),
  startDate: z.coerce.date().optional(),
});

export type CreateLoanSchema = z.infer<typeof createLoanSchema>;
