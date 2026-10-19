import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/routes';

/** Every page that shows money moving: after anything that moves it. */
export function revalidateMoneyPages() {
  revalidatePath(ROUTES.dashboard);
  revalidatePath(ROUTES.transactions);
  revalidatePath(ROUTES.accounts);
  revalidatePath(ROUTES.budgets);
  revalidatePath(ROUTES.reports);
}
