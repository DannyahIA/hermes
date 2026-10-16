/**
 * Six-slot categorical palette, validated (dataviz validate_palette.js)
 * against this project's own light/dark card surfaces — worst adjacent CVD
 * ΔE 9.1 light / 8.4 dark, worst adjacent normal-vision ΔE 19.6 light / 19.3
 * dark. Never add a 7th slot and never cycle these: anything past slot 6
 * folds into a single "Outros" bucket (see `splitPastLimit`), because a
 * generated 7th hue is indistinguishable from an existing one under CVD.
 */
export const CHART_CATEGORICAL_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
] as const;

export const CHART_OTHER_LABEL = 'Outros';
export const CHART_OTHER_COLOR = 'var(--muted-foreground)';

/**
 * Status colors — reserved for good/bad meaning (money in vs money out,
 * net worth above/below zero). Never reuse these as categorical identity.
 */
export const CHART_INCOME_COLOR = 'var(--success)';
export const CHART_EXPENSE_COLOR = 'var(--destructive)';
export const CHART_PRIMARY_COLOR = 'var(--primary)';

export const CHART_GRID_COLOR = 'var(--border)';
export const CHART_AXIS_TEXT_COLOR = 'var(--muted-foreground)';
