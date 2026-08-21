'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/shared/lib/format-currency';
import { formatDate } from '@/shared/lib/format-date';

import type { ImportPreviewRow } from './actions';

interface ImportPreviewTableProps {
  rows: ImportPreviewRow[];
  onConfirm: (selectedRows: ImportPreviewRow[]) => void;
  onCancel: () => void;
  isConfirming: boolean;
}

/**
 * Renders the parsed-but-not-yet-persisted CSV rows: valid rows are
 * pre-checked, possible-duplicate rows are pre-unchecked (the user opts in
 * to importing them anyway), invalid rows are shown disabled with their
 * rejection reason. Nothing is persisted until `onConfirm` fires with the
 * rows the user kept checked.
 */
export function ImportPreviewTable({
  rows,
  onConfirm,
  onCancel,
  isConfirming,
}: ImportPreviewTableProps) {
  const [checked, setChecked] = useState<Set<number>>(
    () =>
      new Set(
        rows.filter((r) => r.status === 'valid').map((r) => r.lineNumber),
      ),
  );

  function toggle(lineNumber: number) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(lineNumber)) next.delete(lineNumber);
      else next.add(lineNumber);
      return next;
    });
  }

  const selectedRows = rows.filter(
    (r) => r.status !== 'invalid' && checked.has(r.lineNumber),
  );
  const invalidCount = rows.filter((r) => r.status === 'invalid').length;

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">
        {selectedRows.length} de {rows.length} linhas serão importadas
        {invalidCount > 0
          ? ` (${invalidCount} inválida${invalidCount === 1 ? '' : 's'})`
          : ''}
        .
      </p>

      <div className="max-h-80 space-y-1 overflow-y-auto">
        {rows.map((row) => (
          <label
            key={row.lineNumber}
            className={`ledger-row flex items-center gap-2 text-sm ${
              row.status === 'invalid' ? 'text-muted-foreground opacity-60' : ''
            }`}
          >
            <input
              type="checkbox"
              disabled={row.status === 'invalid'}
              checked={checked.has(row.lineNumber)}
              onChange={() => toggle(row.lineNumber)}
              className="border-input h-4 w-4 rounded"
            />
            <span className="flex-1 truncate">
              {row.status === 'invalid'
                ? `Linha ${row.lineNumber}: ${row.reason}`
                : row.description}
              {row.status === 'valid_possible_duplicate' && (
                <span className="text-warning ml-2 text-xs">
                  possível duplicata
                </span>
              )}
            </span>
            {row.status !== 'invalid' && (
              <>
                <span className="text-muted-foreground text-xs">
                  {formatDate(new Date(row.occurredAt))}
                </span>
                <span className="ledger-figure">
                  {formatCurrency(row.amount)}
                </span>
              </>
            )}
          </label>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isConfirming}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={() => onConfirm(selectedRows)}
          disabled={isConfirming || selectedRows.length === 0}
        >
          {isConfirming ? 'Importando…' : `Importar ${selectedRows.length}`}
        </Button>
      </div>
    </div>
  );
}
