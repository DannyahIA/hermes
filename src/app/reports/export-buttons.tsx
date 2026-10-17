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
        className="border-input bg-background hover:bg-accent rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
      >
        Exportar CSV
      </a>
      <a
        href={`/api/reports/export?${periodQueryString}&tab=${activeTab}&format=pdf`}
        className="border-input bg-background hover:bg-accent rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
      >
        Exportar PDF
      </a>
    </div>
  );
}
