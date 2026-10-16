import Link from 'next/link';

import { cn } from '@/shared/lib/cn';

export type ReportTab = 'overview' | 'accounts' | 'comparisons';

const TABS: Array<{ id: ReportTab; label: string }> = [
  { id: 'overview', label: 'Visão geral' },
  { id: 'accounts', label: 'Por conta' },
  { id: 'comparisons', label: 'Comparações' },
];

interface ReportTabsNavProps {
  activeTab: ReportTab;
  /** The current `from`/`to` query string (without `tab`), so switching tabs keeps the selected period. */
  periodQueryString: string;
}

/**
 * Plain links, not a client-side tab widget — the whole page is a Server
 * Component and each tab is one more `?tab=` render, so navigation works
 * with zero client JS, same as the period filter form beside it.
 */
export function ReportTabsNav({
  activeTab,
  periodQueryString,
}: ReportTabsNavProps) {
  return (
    <nav
      aria-label="Seções do relatório"
      className="border-border flex gap-1 border-b"
    >
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={`?${periodQueryString}&tab=${tab.id}`}
          aria-current={activeTab === tab.id ? 'page' : undefined}
          className={cn(
            'rounded-t-md border-b-2 px-4 py-2 text-sm font-medium transition-colors',
            activeTab === tab.id
              ? 'border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground border-transparent',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
