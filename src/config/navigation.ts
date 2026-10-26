import type { LucideIcon } from 'lucide-react';
import {
  Home,
  ReceiptText,
  Settings,
  Tags,
  TrendingUp,
  Wallet,
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
  { href: ROUTES.dashboard, label: 'Início', icon: Home },
  { href: ROUTES.accounts, label: 'Meu Dinheiro', icon: Wallet },
  { href: ROUTES.transactions, label: 'Transações', icon: ReceiptText },
  { href: ROUTES.categories, label: 'Categorias', icon: Tags },
  { href: ROUTES.reports, label: 'Relatórios', icon: TrendingUp },
  { href: ROUTES.settings, label: 'Configurações', icon: Settings },
];
