const NAIROBI_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Nairobi',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The calendar date in Nairobi right now, as numbers. */
export function nairobiDay(now: Date) {
  const parts = NAIROBI_DAY.formatToParts(now);
  const part = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return { year: part('year'), month: part('month'), day: part('day') };
}

/**
 * Today's Nairobi date as UTC midnight: the form `@db.Date` columns are
 * compared against.
 */
export function nairobiMidnightUtc(now: Date): Date {
  const { year, month, day } = nairobiDay(now);
  return new Date(Date.UTC(year, month - 1, day));
}
