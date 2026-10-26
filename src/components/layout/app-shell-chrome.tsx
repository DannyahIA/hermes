'use client';

import {
  ChevronsUpDown,
  LogOut,
  Menu as MenuIcon,
  Moon,
  PanelLeft,
  Plus,
  Sun,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import { signOutAction } from '@/app/(auth)/actions';
import { CreateTransactionDialog } from '@/app/transactions/create-transaction-dialog';
import { Button } from '@/components/ui/button';
import { Menu, MenuItem } from '@/components/ui/menu';
import { APP_NAME } from '@/config/constants';
import { type NavigationItem, PRIMARY_NAVIGATION } from '@/config/navigation';
import { ROUTES } from '@/config/routes';
import { useTheme } from '@/shared/components/theme-toggle';
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

// Settings sits apart at the foot of the list, away from the places people
// go to every day (Linear's split between the work and the workspace).
const MAIN_NAVIGATION = PRIMARY_NAVIGATION.filter(
  (item) => item.href !== ROUTES.settings,
);
const FOOT_NAVIGATION = PRIMARY_NAVIGATION.filter(
  (item) => item.href === ROUTES.settings,
);

export function AppShellChrome({
  userLabel,
  accounts,
  categories,
  children,
}: AppShellChromeProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const scrollRootRef = useRef<HTMLDivElement>(null);
  // Whether the page's own large title is on screen, for the page it was
  // measured on — a stale reading from the previous page counts as "not".
  const [pageTitle, setPageTitle] = useState({ path: '', inView: false });
  const titleInView = pageTitle.path === pathname && pageTitle.inView;

  useEffect(() => {
    // Same rationale as useTheme: syncing from localStorage (a system
    // outside React) is what effects are for — reading it during render
    // would risk a server/client hydration mismatch, since the server has
    // no localStorage to check against.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');
  }, []);

  // Switching pages must open the new one at the top of the content, which is
  // now the scroll container, not the window.
  useEffect(() => {
    if (scrollRootRef.current) scrollRootRef.current.scrollTop = 0;
  }, [pathname]);

  // The header shows the page title only once the page's large title has
  // scrolled away, so the name is never on screen twice.
  useEffect(() => {
    const root = scrollRootRef.current;
    const heading = root?.querySelector('[data-page-title]');
    if (!root || !heading || typeof IntersectionObserver === 'undefined') {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) =>
        setPageTitle({ path: pathname, inView: entry.isIntersecting }),
      { root },
    );
    observer.observe(heading);
    return () => observer.disconnect();
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
  }

  const currentPage = PRIMARY_NAVIGATION.find((item) =>
    isActiveRoute(pathname, item.href),
  );

  return (
    <div className="text-foreground bg-background flex h-dvh overflow-hidden">
      <a
        href="#conteudo"
        className="bg-inverse text-inverse-foreground focus-visible:outline-ring fixed top-2 left-2 z-50 -translate-y-16 rounded-md px-3 py-2 text-sm font-medium transition-transform duration-[var(--duration-fast)] focus:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Pular para o conteúdo
      </a>
      <aside
        className={cn(
          'bg-sidebar hidden shrink-0 flex-col transition-[width] duration-[var(--duration-slow)] ease-[var(--ease-out-soft)] lg:flex',
          collapsed ? 'w-[3.75rem]' : 'w-60',
        )}
      >
        <SidebarContent
          pathname={pathname}
          userLabel={userLabel}
          iconOnly={collapsed}
        />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            aria-label="Menu"
            className="bg-sidebar relative flex h-full w-72 max-w-[85vw] flex-col shadow-[var(--shadow-elevation)]"
          >
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Fechar menu"
              className="absolute top-2 right-2"
              onClick={() => setMobileOpen(false)}
            >
              <X />
            </Button>
            <SidebarContent
              pathname={pathname}
              userLabel={userLabel}
              onNavigate={() => setMobileOpen(false)}
              touch
            />
          </aside>
        </div>
      )}

      {/* The canvas: one solid surface for all content, inset from the
          window on a wide screen. `overflow-clip` only trims its corners;
          the element that scrolls is the `data-scroll-root` below, and the
          transaction list's `sticky` toolbar (on a phone) sticks to it. */}
      <div className="flex min-w-0 flex-1 flex-col lg:py-2 lg:pr-2">
        <div className="bg-card lg:border-border flex min-h-0 flex-1 flex-col overflow-clip lg:rounded-xl lg:border">
          <header className="border-border flex h-12 shrink-0 items-center gap-1 border-b px-2 sm:px-3">
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              aria-label="Abrir menu"
              onClick={() => setMobileOpen(true)}
            >
              <MenuIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="hidden lg:inline-flex"
              onClick={toggleCollapsed}
              aria-label={
                collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'
              }
            >
              <PanelLeft />
            </Button>
            <p
              aria-hidden={titleInView}
              className={cn(
                'font-display ml-1 min-w-0 flex-1 truncate text-sm font-semibold transition-opacity duration-[var(--duration-base)]',
                titleInView && 'opacity-0',
              )}
            >
              {currentPage?.label ?? APP_NAME}
            </p>

            <CreateTransactionDialog
              accounts={accounts}
              categories={categories}
              trigger={(open) => (
                <Button
                  size="sm"
                  className="max-sm:size-8 max-sm:px-0"
                  onClick={open}
                  aria-label="Nova transação"
                >
                  <Plus />
                  <span className="max-sm:hidden">Nova transação</span>
                </Button>
              )}
            />
          </header>

          <div
            ref={scrollRootRef}
            data-scroll-root
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          >
            <div className="flex min-h-full flex-col">
              <main
                id="conteudo"
                tabIndex={-1}
                className="mx-auto w-full max-w-[72rem] flex-1 px-4 py-5 outline-none sm:px-6 lg:px-8 lg:py-7"
              >
                {children}
              </main>

              <footer className="text-muted-foreground mx-auto w-full max-w-[72rem] px-4 pt-2 pb-6 text-xs sm:px-6 lg:px-8">
                {APP_NAME} © 2026
              </footer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarContent({
  pathname,
  userLabel,
  iconOnly = false,
  touch = false,
  onNavigate,
}: {
  pathname: string;
  userLabel: string;
  iconOnly?: boolean;
  /** Taller rows for the phone drawer: fingers, not a pointer. */
  touch?: boolean;
  onNavigate?: () => void;
}) {
  const link = (item: NavigationItem) => {
    const Icon = item.icon;
    const active = isActiveRoute(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        aria-label={iconOnly ? item.label : undefined}
        title={iconOnly ? item.label : undefined}
        className={cn(
          'focus-visible:outline-ring flex items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors duration-[var(--duration-fast)] focus-visible:outline-2 focus-visible:-outline-offset-2',
          touch ? 'h-10' : 'h-8',
          iconOnly && 'justify-center px-0',
          active
            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
            : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
        )}
      >
        <Icon
          aria-hidden
          className={cn(
            'size-4 shrink-0',
            active ? 'opacity-100' : 'opacity-70',
          )}
        />
        {!iconOnly && <span className="truncate">{item.label}</span>}
      </Link>
    );
  };

  return (
    <>
      <div
        className={cn(
          'flex h-12 shrink-0 items-center gap-2.5 px-4',
          iconOnly && 'justify-center px-0',
        )}
      >
        <span
          aria-hidden
          className="bg-primary text-primary-foreground font-display flex size-6 shrink-0 items-center justify-center rounded-[0.4375rem] text-[0.8125rem] font-semibold"
        >
          H
        </span>
        {!iconOnly && (
          <span className="font-display text-sm font-semibold">{APP_NAME}</span>
        )}
      </div>

      <nav
        aria-label="Principal"
        className="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto px-2 pt-2"
      >
        {MAIN_NAVIGATION.map(link)}
        <div className="mt-auto flex flex-col gap-px pt-4">
          {FOOT_NAVIGATION.map(link)}
        </div>
      </nav>

      <div className="shrink-0 p-2">
        <AccountMenu userLabel={userLabel} iconOnly={iconOnly} touch={touch} />
      </div>
    </>
  );
}

/**
 * The account row at the foot of the sidebar: who is signed in, plus the
 * two things that belong to the person rather than to a page — appearance
 * and signing out.
 */
function AccountMenu({
  userLabel,
  iconOnly,
  touch,
}: {
  userLabel: string;
  iconOnly: boolean;
  touch: boolean;
}) {
  const { isDark, toggle } = useTheme();
  const [signingOut, startSignOut] = useTransition();
  const initial = userLabel.trim().charAt(0).toUpperCase() || '?';

  return (
    <Menu
      label={`Conta de ${userLabel}`}
      align="start"
      triggerClassName={cn(
        'hover:bg-sidebar-accent/60 aria-expanded:bg-sidebar-accent focus-visible:outline-ring text-sidebar-foreground flex w-full items-center gap-2.5 rounded-md px-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2',
        touch ? 'h-11' : 'h-9',
        iconOnly && 'justify-center px-0',
      )}
      trigger={
        <>
          <span
            aria-hidden
            className="bg-secondary text-secondary-foreground border-border flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold"
          >
            {initial}
          </span>
          {!iconOnly && (
            <>
              <span className="min-w-0 flex-1 truncate font-medium">
                {userLabel}
              </span>
              <ChevronsUpDown
                aria-hidden
                className="text-faint-foreground size-3.5 shrink-0"
              />
            </>
          )}
        </>
      }
    >
      <MenuItem onSelect={toggle}>
        {isDark ? (
          <Sun aria-hidden className="size-4" />
        ) : (
          <Moon aria-hidden className="size-4" />
        )}
        {isDark ? 'Tema claro' : 'Tema escuro'}
      </MenuItem>
      <MenuItem
        onSelect={() =>
          startSignOut(async () => {
            await signOutAction();
          })
        }
      >
        <LogOut aria-hidden className="size-4" />
        {signingOut ? 'Saindo…' : 'Sair'}
      </MenuItem>
    </Menu>
  );
}
