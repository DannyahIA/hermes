const DEFAULT_PERIOD_MONTHS = 6;

/**
 * The period `/reports` and its export route both fall back to when the URL
 * carries no `from`/`to`: the last six calendar months through today. Shared
 * so a report and its export of the same report never silently cover
 * different windows.
 */
export function defaultPeriod(): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(
    now.getFullYear(),
    now.getMonth() - (DEFAULT_PERIOD_MONTHS - 1),
    1,
  );
  return { from, to: now };
}
