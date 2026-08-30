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
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <Link
            href={ROUTES.home}
            className="font-display text-lg font-semibold tracking-tight"
          >
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
