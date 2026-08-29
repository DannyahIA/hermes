import { cache } from 'react';

import { DrizzleAccountRepository } from '@/infra/repositories/drizzle-account.repository';
import { DrizzleCategoryRepository } from '@/infra/repositories/drizzle-category.repository';

export interface ReferenceOption {
  id: string;
  name: string;
}

/**
 * Opções de conta/categoria para o quick-add de transação: precisam existir
 * tanto em `AppShell` (toda página autenticada, para o dialog do header)
 * quanto em `transactions/page.tsx` (para seus próprios filtros/formulários).
 * `cache()` — a mesma técnica que `infra/auth/session.ts` usa para a sessão —
 * faz os dois pontos de chamada, dentro de uma mesma request, compartilharem
 * uma única consulta em vez de duplicá-la.
 */
export const getAccountOptions = cache(
  async (userId: string): Promise<ReferenceOption[]> => {
    const accounts = await new DrizzleAccountRepository().findByUserId(userId);
    return accounts.map((account) => ({ id: account.id, name: account.name }));
  },
);

export const getCategoryOptions = cache(
  async (userId: string): Promise<ReferenceOption[]> => {
    const categories = await new DrizzleCategoryRepository().findByUserId(
      userId,
    );
    return categories.map((category) => ({
      id: category.id,
      name: category.name,
    }));
  },
);
