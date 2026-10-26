import {
  AccountRow,
  type CardBills,
  type RecentLine,
} from '@/app/accounts/account-row';
import { Section, SectionHeader } from '@/components/ui/section';
import type { AccountKind } from '@/core/entities/account';
import type { MoneyOverview } from '@/modules/accounts/application/get-money-overview.use-case';

const GROUP_TITLES: Record<AccountKind, string> = {
  checking: 'Contas correntes',
  credit: 'Cartões',
  savings: 'Reservas',
};

const dayMonth = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
});

interface AccountListProps {
  groups: MoneyOverview['groups'];
  tucked: MoneyOverview['tucked'];
  /** Each account's latest transactions, by account id. */
  recent: Record<string, RecentLine[]>;
  /** Each card's bills, by account id. */
  statements: Record<string, CardBills>;
  payingAccounts: Array<{ id: string; name: string }>;
}

/** The accounts, one thin row each, grouped by kind; a row opens in place. */
export function AccountList({
  groups,
  tucked,
  recent,
  statements,
  payingAccounts,
}: AccountListProps) {
  const row = (line: MoneyOverview['tucked'][number]) => (
    <AccountRow
      key={line.id}
      account={line}
      nextDueLabel={line.nextDue && dayMonth.format(line.nextDue)}
      recent={recent[line.id] ?? []}
      statement={statements[line.id]}
      payingAccounts={payingAccounts}
    />
  );

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <Section key={group.kind}>
          <SectionHeader
            title={GROUP_TITLES[group.kind]}
            count={group.accounts.length}
          />
          <ul>{group.accounts.map(row)}</ul>
        </Section>
      ))}

      {tucked.length > 0 && (
        <details className="group">
          <summary className="text-muted-foreground hover:text-foreground focus-visible:outline-ring cursor-pointer rounded-sm text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2">
            Arquivadas e ocultas ({tucked.length})
          </summary>
          <ul className="mt-2">{tucked.map(row)}</ul>
        </details>
      )}
    </div>
  );
}
