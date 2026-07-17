import Link from 'next/link';
import {
  Home,
  LayoutGrid,
  PiggyBank,
  ReceiptText,
  Settings,
  Menu,
  PanelLeftClose,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const navigation = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/accounts', label: 'Accounts', icon: LayoutGrid },
  { href: '/transactions', label: 'Transactions', icon: ReceiptText },
  { href: '/budgets', label: 'Budgets', icon: PiggyBank },
  { href: '/settings', label: 'Settings', icon: Settings },
];

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="text-foreground min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.08),_transparent_40%),linear-gradient(135deg,_#f8fafc_0%,_#eef2ff_100%)]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-4 lg:px-6 lg:py-6">
        <div className="border-border/70 bg-background/80 flex flex-1 overflow-hidden rounded-[32px] border shadow-[var(--shadow-elevation)] backdrop-blur-xl">
          <aside className="border-border/70 bg-sidebar hidden w-72 flex-col border-r px-5 py-6 lg:flex">
            <div className="mb-8 flex items-center gap-3">
              <div className="bg-primary text-primary-foreground flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-semibold">
                H
              </div>
              <div>
                <p className="text-sm font-semibold">Hermes</p>
                <p className="text-muted-foreground text-xs">Financial OS</p>
              </div>
            </div>

            <nav className="space-y-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto">
              <Card className="border-border/70 bg-card/70 p-4">
                <p className="text-sm font-semibold">Premium workspace</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Everything you need to manage money with calm precision.
                </p>
              </Card>
            </div>
          </aside>

          <div className="flex flex-1 flex-col">
            <header className="border-border/70 flex items-center justify-between border-b px-4 py-4 sm:px-6 lg:px-6">
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" className="lg:hidden">
                  <Menu className="h-4 w-4" />
                </Button>
                <div>
                  <p className="text-sm font-semibold">Good evening</p>
                  <p className="text-muted-foreground text-sm">
                    Welcome back to Hermes
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon">
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
                <Button>New transaction</Button>
              </div>
            </header>

            <main className="flex-1 p-4 sm:p-6 lg:p-6">{children}</main>

            <footer className="border-border/70 text-muted-foreground border-t px-4 py-4 text-sm sm:px-6">
              Hermes © 2026 · Premium finance experience
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
