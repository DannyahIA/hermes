import { Section, SectionHeader } from '@/components/ui/section';
import type { AccountKind } from '@/core/entities/account';
import type {
  AccountLine,
  MoneyOverview,
} from '@/modules/accounts/application/get-money-overview.use-case';
import { formatCurrency } from '@/shared/lib/format-currency';

const GROUP_TITLES: Record<AccountKind, string> = {
  checking: 'Contas correntes',
  credit: 'Cartões',
  savings: 'Reservas',
};

const dayMonth = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
});

function cardNote(line: AccountLine): string | null {
  if (line.type !== 'credit') return null;
  const parts: string[] = [];
  if (line.closingDay) parts.push(`fecha dia ${line.closingDay}`);
  if (line.dueDay) parts.push(`vence dia ${line.dueDay}`);
  if (line.nextDue)
    parts.push(`próximo vencimento ${dayMonth.format(line.nextDue)}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

function AccountRow({ line }: { line: AccountLine }) {
  const note = cardNote(line);
  return (
    <li className="dimension-row">
      <div className="min-w-0">
        <p className="truncate font-medium" title={line.name}>
          {line.name}
        </p>
        {note && <p className="text-muted-foreground text-xs">{note}</p>}
      </div>
      <p className="dimension-figure font-semibold whitespace-nowrap">
        {formatCurrency(line.balance, line.currency)}
      </p>
    </li>
  );
}

interface AccountListProps {
  groups: MoneyOverview['groups'];
  tucked: MoneyOverview['tucked'];
}

/** The accounts, one thin row each, grouped by kind. */
export function AccountList({ groups, tucked }: AccountListProps) {
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <Section key={group.kind}>
          <SectionHeader
            title={GROUP_TITLES[group.kind]}
            count={group.accounts.length}
          />
          <ul>
            {group.accounts.map((line) => (
              <AccountRow key={line.id} line={line} />
            ))}
          </ul>
        </Section>
      ))}

      {tucked.length > 0 && (
        <details className="group">
          <summary className="text-muted-foreground hover:text-foreground focus-visible:outline-ring cursor-pointer rounded-sm text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2">
            Arquivadas e ocultas ({tucked.length})
          </summary>
          <ul className="mt-2">
            {tucked.map((line) => (
              <AccountRow key={line.id} line={line} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
