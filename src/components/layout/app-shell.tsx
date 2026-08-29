import { AppShellChrome } from '@/components/layout/app-shell-chrome';
import { getCurrentSession } from '@/infra/auth/session';
import { withTransaction } from '@/infra/database/transaction';
import { DrizzleAccountRepository } from '@/infra/repositories/drizzle-account.repository';
import { DrizzleRecurringTransactionRepository } from '@/infra/repositories/drizzle-recurring-transaction.repository';
import { DrizzleTransactionRepository } from '@/infra/repositories/drizzle-transaction.repository';
import { GenerateDueOccurrencesUseCase } from '@/modules/recurring-transactions/application/generate-due-occurrences.use-case';
import {
  getAccountOptions,
  getCategoryOptions,
} from '@/shared/server/reference-options';

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * The authenticated app frame (sidebar, header, footer). A Server Component
 * so it can read the session once per request; all interactivity (mobile
 * drawer, theme toggle, active-route highlighting) lives in the client
 * `AppShellChrome` it wraps.
 *
 * It also doubles as the one place every authenticated page passes through,
 * which makes it the natural spot to lazily catch up any due recurring
 * transactions (there's no cron/queue in this app — see
 * `GenerateDueOccurrencesUseCase`'s doc comment). A failure here must never
 * take down the page it's decorating, so it's caught and logged, not thrown.
 */
export async function AppShell({ children }: AppShellProps) {
  const session = await getCurrentSession();
  const userLabel = session?.user.name ?? session?.user.email ?? 'Usuário';

  if (session?.user.id) {
    try {
      await withTransaction((tx) =>
        new GenerateDueOccurrencesUseCase(
          new DrizzleRecurringTransactionRepository(tx),
          new DrizzleTransactionRepository(tx),
          new DrizzleAccountRepository(tx),
        ).execute(session.user.id),
      );
    } catch (error) {
      console.error('Failed to generate due recurring transactions:', error);
    }
  }

  const [accounts, categories] = session?.user.id
    ? await Promise.all([
        getAccountOptions(session.user.id),
        getCategoryOptions(session.user.id),
      ])
    : [[], []];

  return (
    <AppShellChrome
      userLabel={userLabel}
      accounts={accounts}
      categories={categories}
    >
      {children}
    </AppShellChrome>
  );
}
