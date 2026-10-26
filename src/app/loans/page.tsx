import { redirect } from 'next/navigation';

import { ROUTES } from '@/config/routes';

/** Loans live on a tab of Meu Dinheiro now; old links and bookmarks land there. */
export default function LoansPage() {
  redirect(`${ROUTES.accounts}?aba=emprestimos`);
}
