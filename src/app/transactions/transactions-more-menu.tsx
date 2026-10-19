'use client';

import { Ellipsis } from 'lucide-react';
import { useState } from 'react';

import { CreateTransferDialog } from '@/app/transactions/create-transfer-dialog';
import { ImportDialog } from '@/app/transactions/import-dialog';
import { buttonVariants } from '@/components/ui/button';
import { Menu, MenuItem } from '@/components/ui/menu';

interface TransactionsMoreMenuProps {
  accounts: Array<{ id: string; name: string }>;
  /** The CSV export, carrying the list's current filters. */
  exportHref: string;
}

/** What the statement does besides listing: move money, import, export. */
export function TransactionsMoreMenu({
  accounts,
  exportHref,
}: TransactionsMoreMenuProps) {
  const [dialog, setDialog] = useState<'transfer' | 'import' | null>(null);
  const canTransfer = accounts.length >= 2;

  return (
    <>
      <Menu
        label="Mais ações"
        trigger={
          <>
            <Ellipsis aria-hidden className="size-4" />
            <span className="hidden sm:inline">Mais</span>
          </>
        }
        triggerClassName={buttonVariants({
          variant: 'outline',
          size: 'sm',
          className: 'aria-expanded:bg-accent',
        })}
      >
        {canTransfer && (
          <MenuItem onSelect={() => setDialog('transfer')}>
            Transferência entre contas
          </MenuItem>
        )}
        <MenuItem onSelect={() => setDialog('import')}>Importar CSV</MenuItem>
        <MenuItem href={exportHref}>Exportar CSV</MenuItem>
      </Menu>
      {canTransfer && (
        <CreateTransferDialog
          accounts={accounts}
          open={dialog === 'transfer'}
          onOpenChange={(open) => setDialog(open ? 'transfer' : null)}
          trigger={() => null}
        />
      )}
      <ImportDialog
        open={dialog === 'import'}
        onOpenChange={(open) => setDialog(open ? 'import' : null)}
      />
    </>
  );
}
