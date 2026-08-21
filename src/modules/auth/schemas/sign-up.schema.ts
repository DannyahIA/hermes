import { z } from 'zod';

export const signUpSchema = z.object({
  name: z.string().trim().min(1, 'Informe seu nome.').max(255),
  email: z.email('Informe um e-mail válido.'),
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.'),
});

export type SignUpSchema = z.infer<typeof signUpSchema>;
