import { buttonVariants } from '@/components/ui/button';

import type { ReportTab } from './report-tabs-nav';

interface ExportButtonsProps {
  periodQueryString: string;
  /** The PDF prints the tab being viewed as its own sheet (spec §6). */
  activeTab: ReportTab;
}

/**
 * Plain anchors, not buttons: the export route responds with a file
 * download, which a normal navigation already handles — no client JS, and
 * the browser's own "save as" dialog does the rest.
 */
export function ExportButtons({
  periodQueryString,
  activeTab,
}: ExportButtonsProps) {
  return (
    <div className="flex gap-2">
      <a
        href={`/api/reports/export?${periodQueryString}&format=csv`}
        className={buttonVariants({ variant: 'outline' })}
      >
        Exportar CSV
      </a>
      <a
        href={`/api/reports/export?${periodQueryString}&tab=${activeTab}&format=pdf`}
        className={buttonVariants({ variant: 'outline' })}
      >
        Exportar PDF
      </a>
    </div>
  );
}
