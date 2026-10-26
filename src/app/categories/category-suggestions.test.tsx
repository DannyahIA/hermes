import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CategorySuggestions } from '@/app/categories/category-suggestions';
import type { CategoriesOverview } from '@/modules/categories/application/get-categories-overview.use-case';

vi.mock('@/app/categories/actions', () => ({
  archiveCategoryAction: vi.fn(),
  mergeCategoriesAction: vi.fn(),
}));

vi.mock('@/app/dashboard/actions', () => ({
  fileUnderNewCategoryAction: vi.fn(),
}));

type Suggestions = CategoriesOverview['suggestions'];

const saude: Suggestions['create'][number] = {
  key: 'saude',
  name: 'Saúde',
  color: '#22c55e',
  transactionIds: ['t1', 't2', 't3'],
  total: 356.7,
};

const pets: Suggestions['create'][number] = {
  key: 'pets',
  name: 'Pets',
  color: '#a855f7',
  transactionIds: ['t4'],
  total: 90,
};

const supermercado: Suggestions['merge'][number] = {
  keepId: 'category-mercado',
  keepName: 'Mercado',
  mergeId: 'category-supermercado',
  mergeName: 'Supermercado',
  mergeCount: 2,
};

const lazer: Suggestions['archive'][number] = {
  categoryId: 'category-lazer',
  name: 'Lazer',
};

const viagem: Suggestions['archive'][number] = {
  categoryId: 'category-viagem',
  name: 'Viagem',
};

const none: Suggestions = { create: [], archive: [], merge: [] };

describe('CategorySuggestions', () => {
  it('shows three suggestions and reveals the rest on request', () => {
    render(
      <CategorySuggestions
        suggestions={{
          create: [saude, pets],
          archive: [lazer, viagem],
          merge: [supermercado],
        }}
      />,
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByText(/Viagem/)).not.toBeInTheDocument();

    const toggle = screen.getByRole('button', {
      name: 'Ver todas as sugestões (5)',
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);

    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByText(/Viagem/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Mostrar menos' }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows no toggle when there are three suggestions or fewer', () => {
    render(
      <CategorySuggestions
        suggestions={{ create: [saude], archive: [lazer], merge: [] }}
      />,
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(
      screen.queryByRole('button', { name: /Ver todas as sugestões/ }),
    ).not.toBeInTheDocument();
  });

  it('asks before joining two categories, in the singular for one transaction', () => {
    render(
      <CategorySuggestions
        suggestions={{
          ...none,
          merge: [{ ...supermercado, mergeCount: 1 }],
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Juntar' }));

    expect(
      screen.getByText(
        'Juntar Supermercado em Mercado? 1 transação passa para Mercado e Supermercado é arquivada.',
      ),
    ).toBeInTheDocument();
  });
});
