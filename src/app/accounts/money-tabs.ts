export type MoneyTab = 'orcamentos' | 'emprestimos';

export const MONEY_TABS: ReadonlyArray<{ id: MoneyTab; label: string }> = [
  { id: 'orcamentos', label: 'Orçamentos' },
  { id: 'emprestimos', label: 'Empréstimos' },
];

/** The tab named by `?aba=`; anything unknown falls back to budgets. */
export function readMoneyTab(
  params: Record<string, string | string[] | undefined>,
): MoneyTab {
  const raw = Array.isArray(params.aba) ? params.aba[0] : params.aba;
  return MONEY_TABS.find((tab) => tab.id === raw)?.id ?? 'orcamentos';
}
