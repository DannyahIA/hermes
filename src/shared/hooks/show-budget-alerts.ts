import { toast } from './use-toast';

/** One toast per budget alert line an action returned. */
export function showBudgetAlerts(alerts?: string[]): void {
  for (const title of alerts ?? []) {
    toast({ title, variant: 'default' });
  }
}
