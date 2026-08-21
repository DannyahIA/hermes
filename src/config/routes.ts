/**
 * Central registry of application route paths. Pages, navigation, redirects
 * and links should all reference these constants instead of hardcoding
 * strings, so a route rename only ever touches one file.
 */
export const ROUTES = {
  home: '/',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  verifyEmail: '/verify-email',
  dashboard: '/dashboard',
  accounts: '/accounts',
  transactions: '/transactions',
  budgets: '/budgets',
  loans: '/loans',
  categories: '/categories',
  reports: '/reports',
  settings: '/settings',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

/**
 * Routes that require an authenticated session. Enforced by
 * `src/middleware.ts`.
 */
export const PROTECTED_ROUTES: RoutePath[] = [
  ROUTES.dashboard,
  ROUTES.accounts,
  ROUTES.transactions,
  ROUTES.budgets,
  ROUTES.loans,
  ROUTES.categories,
  ROUTES.reports,
  ROUTES.settings,
];

/**
 * Routes only meant for signed-out visitors — an authenticated user landing
 * on one of these is redirected to the dashboard instead.
 */
export const GUEST_ONLY_ROUTES: RoutePath[] = [ROUTES.login, ROUTES.register];
