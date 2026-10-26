'use client';

import { useState } from 'react';

import { CategoryRowMenu } from '@/app/categories/category-row-menu';
import { CategoryTableRow } from '@/app/categories/category-table-row';
import { CategoryDot } from '@/app/dashboard/category-picker';
import type { CategoryRow } from '@/modules/categories/application/get-categories-overview.use-case';

interface CategoryListProps {
  rows: CategoryRow[];
  incomeRows: CategoryRow[];
  archived: Array<{ id: string; name: string; color?: string }>;
  /** "2026-10": the month the figures are for. */
  month: string;
}

const HEADER_CELL = 'text-muted-foreground py-2 font-medium';

/**
 * The categories of one month as a table. Spending comes first, then the
 * income-only categories under "Entradas", then the archived ones, folded
 * away. On a phone the total and the budget columns are hidden; their
 * figures are in the opened detail.
 */
export function CategoryList({
  rows,
  incomeRows,
  archived,
  month,
}: CategoryListProps) {
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set());

  function toggle(id: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <table className="w-full text-sm">
        <caption className="sr-only">Gasto de cada categoria no mês</caption>
        <thead>
          <tr className="border-border border-b text-left">
            <th scope="col" className={`${HEADER_CELL} pl-4 font-medium`}>
              Categoria
            </th>
            <th scope="col" className={`${HEADER_CELL} pl-2 text-right`}>
              Mês
            </th>
            <th
              scope="col"
              className={`${HEADER_CELL} hidden pl-2 text-right sm:table-cell`}
            >
              Do total
            </th>
            <th scope="col" className={`${HEADER_CELL} pl-2 text-right`}>
              vs mês anterior
            </th>
            <th
              scope="col"
              className={`${HEADER_CELL} hidden pl-2 text-right md:table-cell`}
            >
              Orçamento
            </th>
            <th scope="col" className="w-12 py-2 pr-2">
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                className="text-muted-foreground px-4 py-6 text-center"
              >
                Nenhuma categoria de gasto ativa.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <CategoryTableRow
                key={row.id}
                row={row}
                side="expense"
                month={month}
                open={openIds.has(row.id)}
                onToggle={toggle}
              />
            ))
          )}
        </tbody>

        {incomeRows.length > 0 && (
          <>
            <tbody>
              <tr className="border-border border-b">
                <th
                  scope="colgroup"
                  colSpan={6}
                  className="text-muted-foreground px-4 pt-5 pb-2 text-left text-xs font-medium"
                >
                  Entradas
                </th>
              </tr>
            </tbody>
            <tbody>
              {incomeRows.map((row) => (
                <CategoryTableRow
                  key={row.id}
                  row={row}
                  side="income"
                  month={month}
                  open={openIds.has(row.id)}
                  onToggle={toggle}
                />
              ))}
            </tbody>
          </>
        )}
      </table>

      {archived.length > 0 && (
        <details className="border-border border-t">
          <summary className="text-muted-foreground hover:text-foreground cursor-pointer px-4 py-3 text-sm">
            {`Arquivadas (${archived.length})`}
          </summary>
          <ul className="px-4 pb-2">
            {archived.map((category) => (
              <li key={category.id} className="dimension-row">
                <span className="flex min-w-0 items-center gap-2">
                  <CategoryDot color={category.color} />
                  <span className="truncate">{category.name}</span>
                </span>
                <CategoryRowMenu
                  id={category.id}
                  name={category.name}
                  color={category.color}
                  archived
                />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
