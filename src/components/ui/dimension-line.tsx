import { cn } from '@/shared/lib/cn';

interface DimensionLineProps {
  /** The measured span's label — e.g. "compromissos futuros". */
  label: string;
  className?: string;
}

/**
 * The signature element of the "Prancheta" design system: a dimension-line
 * annotation, exactly like the tick-marked measurement lines under a span
 * in a technical drawing. Used to mark the *relationship* between two
 * adjacent figures (e.g. saldo atual vs. projetado) instead of just
 * stacking the numbers — the eye reads the gap as a measured quantity,
 * which is literally what it is.
 */
export function DimensionLine({ label, className }: DimensionLineProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="dimension-line flex-1" />
      <span className="text-muted-foreground font-mono text-[0.6875rem] tracking-wide uppercase">
        {label}
      </span>
      <span className="dimension-line flex-1" />
    </div>
  );
}
