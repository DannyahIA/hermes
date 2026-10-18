import { z } from 'zod';

/** The most `numeric(12, 2)` holds. */
const MAX_AMOUNT = 9_999_999_999.99;

/**
 * What the quick entry sends once the person presses Enter: the entry as
 * `parseQuickEntry` understood it, with any field they changed by hand.
 * `occurredAt` is an instant (ISO 8601), worked out in the browser so
 * "hoje" and "ontem" mean the person's day.
 */
export const recordQuickEntrySchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, 'Diga o que foi, como em "almoço 32,50".')
    .max(255, 'A descrição passa de 255 caracteres.'),
  amount: z
    .number()
    .positive('O valor deve ser maior que zero.')
    .max(MAX_AMOUNT, 'O valor é alto demais.')
    .transform((amount) => Math.round(amount * 100) / 100),
  type: z.enum(['income', 'expense']),
  accountId: z.uuid('Escolha uma conta.'),
  categoryId: z
    .uuid('Categoria inválida.')
    .nullish()
    .transform((id) => id ?? undefined),
  occurredAt: z.iso
    .datetime({ message: 'Data inválida.' })
    .transform((iso) => new Date(iso)),
});

export type RecordQuickEntrySchema = z.input<typeof recordQuickEntrySchema>;
