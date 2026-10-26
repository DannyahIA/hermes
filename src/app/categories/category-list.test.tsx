import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CategoryList } from '@/app/categories/category-list';
import type { CategoryRow } from '@/modules/categories/application/get-categories-overview.use-case';

vi.mock('@/app/categories/actions', () => ({
  archiveCategoryAction: vi.fn(),
  deleteCategoryAction: vi.fn(),
  updateCategoryAction: vi.fn(),
  mergeCategoriesAction: vi.fn(),
}));

const mercadoRow: CategoryRow = {
  id: 'category-mercado',
  name: 'Mercado',
  color: '#16a34a',
  spent: 1240,
  count: 18,
  share: 0.42,
  previous: 1000,
  deltaPercent: 24,
  budget: { spent: 1240, amount: 1500 },
  months: [800, 900, 1000, 950, 1000, 1240],
  topMerchants: [{ name: 'Mercado Condor', total: 900 }],
};

const restaurantesRow: CategoryRow = {
  id: 'category-restaurantes',
  name: 'Restaurantes',
  color: '#f97316',
  spent: 440,
  count: 6,
  share: 0.18,
  previous: 500,
  deltaPercent: -12,
  budget: null,
  months: [300, 420, 500, 480, 500, 440],
  topMerchants: [{ name: 'Cantina Aurora', total: 310 }],
};

const padariaRow: CategoryRow = {
  id: 'category-padaria',
  name: 'Padaria',
  spent: 50,
  count: 2,
  share: 0.02,
  previous: 0,
  deltaPercent: null,
  budget: { spent: 50, amount: 200 },
  months: [0, 0, 0, 0, 0, 50],
  topMerchants: [{ name: 'Padaria Real', total: 50 }],
};

const salarioRow: CategoryRow = {
  id: 'category-salario',
  name: 'Salário',
  color: '#0ea5e9',
  spent: 8500,
  count: 1,
  share: 1,
  previous: 7870,
  deltaPercent: 8,
  budget: null,
  months: [7870, 7870, 7870, 7870, 7870, 8500],
  topMerchants: [{ name: 'Empresa Acme', total: 8500 }],
};

describe('CategoryList', () => {
  it('lists the categories as rows and opens one to show where the money went', () => {
    render(
      <CategoryList
        rows={[mercadoRow, restaurantesRow]}
        incomeRows={[]}
        archived={[]}
        month="2026-10"
      />,
    );
    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Mercado');
    expect(within(rows[1]).getByText('▲ 24%')).toHaveClass('text-destructive');

    // Anchored: the row menu's trigger is "Ações de Mercado", which also
    // contains "Mercado".
    fireEvent.click(within(rows[1]).getByRole('button', { name: /^Mercado/ }));

    expect(screen.getByText('Mercado Condor')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Ver as 18 transações/ }),
    ).toHaveAttribute(
      'href',
      '/transactions?categoryId=' +
        mercadoRow.id +
        '&from=2026-10-01&to=2026-10-31',
    );
  });

  it('shows a decrease as a green down arrow with the absolute percent', () => {
    render(
      <CategoryList
        rows={[restaurantesRow]}
        incomeRows={[]}
        archived={[]}
        month="2026-10"
      />,
    );
    expect(screen.getByText('▼ 12%')).toHaveClass('text-success');
  });

  it('shows a missing comparison as a muted dash', () => {
    render(
      <CategoryList
        rows={[padariaRow]}
        incomeRows={[]}
        archived={[]}
        month="2026-10"
      />,
    );
    expect(screen.getByText('—')).toHaveClass('text-muted-foreground');
  });

  it('shows income going up in green, since more income is good news', () => {
    render(
      <CategoryList
        rows={[]}
        incomeRows={[salarioRow]}
        archived={[]}
        month="2026-10"
      />,
    );
    expect(screen.getByText('Entradas')).toBeInTheDocument();
    expect(screen.getByText('▲ 8%')).toHaveClass('text-success');
  });

  it('lists archived categories inside a collapsed group', () => {
    render(
      <CategoryList
        rows={[mercadoRow]}
        incomeRows={[]}
        archived={[{ id: 'category-lazer', name: 'Lazer' }]}
        month="2026-10"
      />,
    );
    const group = screen.getByText('Arquivadas (1)').closest('details');
    expect(group).toBeInTheDocument();
    expect(group).not.toHaveAttribute('open');
    expect(group).toContainElement(screen.getByText('Lazer'));
  });
});
