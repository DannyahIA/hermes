import Link from 'next/link';

import { APP_NAME } from '@/config/constants';
import { ROUTES } from '@/config/routes';
import { getCurrentSession } from '@/infra/auth/session';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();

  return (
    <div className="bg-background min-h-screen">
      <header className="border-border border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link
            href={ROUTES.home}
            className="font-display focus-visible:outline-ring flex items-center gap-2.5 rounded-sm text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            <span
              aria-hidden
              className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-[0.4375rem] text-[0.8125rem]"
            >
              H
            </span>
            {APP_NAME}
          </Link>
          {session && (
            <Link
              href={ROUTES.dashboard}
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              Continuar para o dashboard
            </Link>
          )}
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
