import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const changeMerchantRuleCategoryAction = vi.fn<
  (input: { ruleId: string; categoryId: string }) => Promise<{
    success: true;
  }>
>(async () => ({ success: true }));

vi.mock('./actions', () => ({
  changeMerchantRuleCategoryAction: (input: {
    ruleId: string;
    categoryId: string;
  }) => changeMerchantRuleCategoryAction(input),
  forgetMerchantRuleAction: vi.fn(async () => ({ success: true })),
}));

import { MerchantRules, type MerchantRuleView } from './merchant-rules';

const categories = [
  { id: 'mercado', name: 'Mercado' },
  { id: 'restaurantes', name: 'Restaurantes' },
];

function rule(n: number, name: string): MerchantRuleView {
  return {
    id: `rule-${n}`,
    name,
    categoryId: 'restaurantes',
    usage: 'Escolhida uma vez',
  };
}

describe('the merchants list', () => {
  it('files a merchant under the category chosen', async () => {
    render(
      <MerchantRules
        rules={[rule(1, 'Padaria Real')]}
        categories={categories}
      />,
    );

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'mercado' },
    });

    await waitFor(() =>
      expect(changeMerchantRuleCategoryAction).toHaveBeenCalledWith({
        ruleId: 'rule-1',
        categoryId: 'mercado',
      }),
    );
  });

  it('finds a merchant by name, ignoring accents, once the list is long', () => {
    const names = [
      'Açaí da Praia',
      'Café Central',
      'Drogasil',
      'Mercado Condor',
      'Padaria Real',
      'Posto Ipiranga',
      'Uber',
      'Zaffari',
    ];
    render(
      <MerchantRules
        rules={names.map((name, n) => rule(n, name))}
        categories={categories}
      />,
    );

    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'acai' },
    });

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('Açaí da Praia')).toBeInTheDocument();
  });
});
