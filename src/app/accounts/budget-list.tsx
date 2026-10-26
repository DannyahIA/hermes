import { BudgetRow, type BudgetRowProps } from '@/app/budgets/budget-row';

interface BudgetListProps {
  running: BudgetRowProps[];
  ended: BudgetRowProps[];
  /** "Parcelas de novembro: R$ 320,00"; left out when there is nothing to say. */
  installmentsLabel?: string;
}

/** The budgets as thin rows on one sheet, the ended ones folded away below. */
export function BudgetList({
  running,
  ended,
  installmentsLabel,
}: BudgetListProps) {
  return (
    <div className="space-y-3">
      {installmentsLabel && (
        <p className="dimension-figure text-muted-foreground text-sm">
          {installmentsLabel}
        </p>
      )}
      {running.length > 0 && (
        <ul className="sheet-surface">
          {running.map((row) => (
            <BudgetRow key={row.budgetId} {...row} />
          ))}
        </ul>
      )}
      {ended.length > 0 && (
        <details className="sheet-surface">
          <summary className="hover:bg-subtle focus-visible:ring-ring cursor-pointer rounded-sm px-4 py-2.5 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none">
            {`Encerrados (${ended.length})`}
          </summary>
          <ul className="border-border border-t">
            {ended.map((row) => (
              <BudgetRow key={row.budgetId} {...row} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
