'use client';

import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { signOutAction } from '@/app/(auth)/actions';
import { CreateTransactionDialog } from '@/app/transactions/create-transaction-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { APP_NAME } from '@/config/constants';
import { PRIMARY_NAVIGATION } from '@/config/navigation';
import { ThemeToggle } from '@/shared/components/theme-toggle';
import { cn } from '@/shared/lib/cn';

interface AppShellChromeProps {
  userLabel: string;
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  children: React.ReactNode;
}

function isActiveRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const SIDEBAR_COLLAPSED_KEY = 'hermes-sidebar-collapsed';

export function AppShellChrome({
  userLabel,
  accounts,
  categories,
  children,
}: AppShellChromeProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // Same rationale as ThemeToggle: syncing from localStorage (a system
    // outside React) is what effects are for — reading it during render
    // would risk a server/client hydration mismatch, since the server has
    // no localStorage to check against.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
  }

  const currentPage = PRIMARY_NAVIGATION.find((item) =>
    isActiveRoute(pathname, item.href),
  );

  const navLinks = (onNavigate?: () => void, iconOnly = false) =>
    PRIMARY_NAVIGATION.map((item) => {
      const Icon = item.icon;
      const active = isActiveRoute(pathname, item.href);
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          aria-current={active ? 'page' : undefined}
          title={iconOnly ? item.label : undefined}
          className={cn(
            'flex items-center gap-3 border-l-[3px] px-3 py-2.5 text-sm font-medium transition-colors',
            iconOnly && 'justify-center px-0',
            active
              ? 'border-ring bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground border-transparent',
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {!iconOnly && item.label}
        </Link>
      );
    });

  return (
    <div className="text-foreground min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(232,162,61,0.08),_transparent_40%)]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-4 lg:px-6 lg:py-6">
        <div className="border-border/70 bg-background/80 flex flex-1 overflow-hidden rounded-[1.25rem] border shadow-[var(--shadow-elevation)] backdrop-blur-xl">
          <aside
            className={cn(
              'border-border/70 bg-sidebar hidden shrink-0 flex-col border-r py-6 transition-[width] duration-200 lg:flex',
              collapsed ? 'w-[4.5rem]' : 'w-72',
            )}
          >
            <div className={cn('px-5', collapsed && 'px-3')}>
              <SidebarBrand hideText={collapsed} />
            </div>
            <nav className="space-y-0.5 px-2">
              {navLinks(undefined, collapsed)}
            </nav>
            {!collapsed && (
              <div className="mt-auto px-5">
                <Card className="registration-frame bg-card/70 p-4">
                  <p className="text-sm font-semibold">{userLabel}</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Sua central de comando financeira.
                  </p>
                </Card>
              </div>
            )}
          </aside>

          {mobileOpen && (
            <div className="fixed inset-0 z-40 lg:hidden">
              <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => setMobileOpen(false)}
              />
              <aside className="bg-sidebar relative flex h-full w-72 flex-col py-6">
                <div className="mb-8 flex items-center justify-between px-5">
                  <SidebarBrand compact />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Fechar menu"
                    onClick={() => setMobileOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <nav className="space-y-0.5 px-2">
                  {navLinks(() => setMobileOpen(false))}
                </nav>
              </aside>
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="border-border/70 flex items-center justify-between gap-2 border-b px-3 py-3 sm:px-6 sm:py-4 lg:px-6">
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0 lg:hidden"
                  aria-label="Abrir menu"
                  onClick={() => setMobileOpen(true)}
                >
                  <Menu className="h-4 w-4" />
                </Button>
                <div className="min-w-0">
                  <p className="font-display truncate text-sm font-semibold">
                    {currentPage?.label ?? APP_NAME}
                  </p>
                  <p className="text-muted-foreground hidden text-sm sm:block">
                    Bem-vindo(a) de volta
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                <ThemeToggle />
                <Button
                  variant="outline"
                  size="icon"
                  className="hidden lg:inline-flex"
                  onClick={toggleCollapsed}
                  aria-label={
                    collapsed
                      ? 'Expandir menu lateral'
                      : 'Recolher menu lateral'
                  }
                >
                  {collapsed ? (
                    <PanelLeftOpen className="h-4 w-4" />
                  ) : (
                    <PanelLeftClose className="h-4 w-4" />
                  )}
                </Button>
                <form action={signOutAction}>
                  <Button
                    variant="outline"
                    type="submit"
                    size="icon"
                    className="h-9 w-9 sm:h-9 sm:w-auto sm:px-3"
                    aria-label="Sair"
                  >
                    <LogOut className="h-4 w-4 sm:hidden" />
                    <span className="hidden sm:inline">Sair</span>
                  </Button>
                </form>
                <CreateTransactionDialog
                  accounts={accounts}
                  categories={categories}
                />
              </div>
            </header>

            <main className="flex-1 p-4 sm:p-6 lg:p-6">{children}</main>

            <footer className="border-border/70 text-muted-foreground border-t px-4 py-4 text-sm sm:px-6">
              {APP_NAME} © 2026
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarBrand({
  compact = false,
  hideText = false,
}: {
  compact?: boolean;
  hideText?: boolean;
}) {
  return (
    <div className={cn('flex items-center gap-3', compact ? '' : 'mb-8')}>
      <div className="bg-primary text-primary-foreground font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-base font-semibold">
        H
      </div>
      {!hideText && (
        <div>
          <p className="font-display text-sm font-semibold">{APP_NAME}</p>
          <p className="text-muted-foreground text-xs">
            Sua prancheta financeira
          </p>
        </div>
      )}
    </div>
  );
}
