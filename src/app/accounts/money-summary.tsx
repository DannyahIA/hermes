import { formatCurrency } from '@/shared/lib/format-currency';

interface MoneySummaryProps {
  checking: number;
  cards: number;
  savings: number;
  installmentsThisMonth: number;
}

/** The four figures at the top of Meu Dinheiro, one line each. */
export function MoneySummary({
  checking,
  cards,
  savings,
  installmentsThisMonth,
}: MoneySummaryProps) {
  const figures = [
    { label: 'Nas contas', value: checking },
    { label: 'Nos cartões', value: cards },
    { label: 'Guardado', value: savings },
    { label: 'Parcelas deste mês', value: installmentsThisMonth },
  ];

  return (
    <dl aria-label="Resumo do seu dinheiro" className="sheet-surface px-4">
      {figures.map((figure) => (
        <div key={figure.label} className="dimension-row">
          <dt className="text-muted-foreground text-sm">{figure.label}</dt>
          <dd className="dimension-figure font-semibold">
            {formatCurrency(figure.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
