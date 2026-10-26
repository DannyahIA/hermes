import { redirect } from 'next/navigation';

import { ROUTES } from '@/config/routes';

/** Budgets live on a tab of Meu Dinheiro now; old links and bookmarks land there. */
export default function BudgetsPage() {
  redirect(`${ROUTES.accounts}?aba=orcamentos`);
}
