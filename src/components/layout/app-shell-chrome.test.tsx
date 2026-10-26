import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppShellChrome } from '@/components/layout/app-shell-chrome';

const routing = vi.hoisted(() => ({ pathname: '/dashboard' }));

vi.mock('next/navigation', () => ({
  usePathname: () => routing.pathname,
}));
vi.mock('@/app/(auth)/actions', () => ({ signOutAction: vi.fn() }));
vi.mock('@/app/transactions/create-transaction-dialog', () => ({
  CreateTransactionDialog: () => null,
}));

afterEach(() => {
  routing.pathname = '/dashboard';
});

function renderShell() {
  return render(
    <AppShellChrome userLabel="Dan" accounts={[]} categories={[]}>
      <p>conteúdo</p>
    </AppShellChrome>,
  );
}

describe('AppShellChrome', () => {
  it('rolls only the content, never the sidebar or the header', () => {
    renderShell();

    const scroller = screen
      .getByRole('main')
      .closest<HTMLElement>('[data-scroll-root]');
    expect(scroller).not.toBeNull();
    expect(scroller).toHaveClass('overflow-y-auto');
    expect(scroller?.contains(screen.getByRole('banner'))).toBe(false);
    expect(scroller?.contains(screen.getByRole('navigation'))).toBe(false);
    expect(scroller?.contains(screen.getByRole('contentinfo'))).toBe(true);
  });

  it('lists Meu Dinheiro in place of Contas, Orçamentos and Empréstimos', () => {
    renderShell();

    const nav = screen.getByRole('navigation');
    const labels = within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent?.trim());
    expect(labels).toContain('Meu Dinheiro');
    expect(labels).not.toContain('Contas');
    expect(labels).not.toContain('Orçamentos');
    expect(labels).not.toContain('Empréstimos');
    expect(
      within(nav).getByRole('link', { name: 'Meu Dinheiro' }),
    ).toHaveAttribute('href', '/accounts');
  });

  it('opens a newly visited page at the top of the content', () => {
    const { rerender } = renderShell();

    const scroller = screen
      .getByRole('main')
      .closest<HTMLElement>('[data-scroll-root]');
    if (!scroller) throw new Error('scroll root not found');
    scroller.scrollTop = 240;

    routing.pathname = '/transactions';
    rerender(
      <AppShellChrome userLabel="Dan" accounts={[]} categories={[]}>
        <p>conteúdo</p>
      </AppShellChrome>,
    );

    expect(scroller.scrollTop).toBe(0);
  });
});
