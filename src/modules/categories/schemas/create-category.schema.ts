import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Informe um nome para a categoria.').max(255),
  description: z
    .string()
    .trim()
    .max(1000, 'A descrição deve ter no máximo 1000 caracteres.')
    .optional()
    .transform((value) => (value === '' ? undefined : value)),
  color: z
    .string()
    .trim()
    .regex(
      /^#[0-9a-fA-F]{6}$/,
      'Informe uma cor hexadecimal válida (ex: #3B82F6).',
    )
    .optional()
    .or(z.literal(''))
    .transform((value) => (value === '' ? undefined : value)),
});

export type CreateCategorySchema = z.infer<typeof createCategorySchema>;
