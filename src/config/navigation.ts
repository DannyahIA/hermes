import type { LucideIcon } from 'lucide-react';
import {
  Home,
  Landmark,
  LayoutGrid,
  PiggyBank,
  ReceiptText,
  Tags,
  TrendingUp,
} from 'lucide-react';

import { ROUTES } from '@/config/routes';

export interface NavigationItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Primary sidebar navigation, in display order. The Sidebar component
 * highlights whichever item's `href` prefixes the current pathname.
 */
export const PRIMARY_NAVIGATION: NavigationItem[] = [
  { href: ROUTES.dashboard, label: 'Dashboard', icon: Home },
  { href: ROUTES.accounts, label: 'Contas', icon: LayoutGrid },
  { href: ROUTES.transactions, label: 'Transações', icon: ReceiptText },
  { href: ROUTES.budgets, label: 'Orçamentos', icon: PiggyBank },
  { href: ROUTES.loans, label: 'Empréstimos', icon: Landmark },
  { href: ROUTES.categories, label: 'Categorias', icon: Tags },
  { href: ROUTES.reports, label: 'Relatórios', icon: TrendingUp },
];
