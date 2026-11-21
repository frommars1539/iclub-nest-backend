import { PROVISIONAL_TERM_NAME } from './club.constants';

const NAIROBI_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Nairobi',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The calendar date in Nairobi right now, as numbers. */
function nairobiToday(now: Date) {
  const parts = NAIROBI_DAY.formatToParts(now);
  const part = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return { year: part('year'), month: part('month'), day: part('day') };
}

/**
 * A term that starts today (Nairobi) and ends the day before the same date
 * next year. It exists only so the registrant holds a real appointment from
 * the first second; the setup wizard's term step overwrites it.
 *
 * Dates are built as UTC midnight because `start_date`/`end_date` are
 * `@db.Date` columns, which store a calendar day with no time zone.
 */
export function provisionalTerm(now: Date) {
  const { year, month, day } = nairobiToday(now);
  return {
    name: PROVISIONAL_TERM_NAME,
    startDate: new Date(Date.UTC(year, month - 1, day)),
    // Day 0 of a month is the last day of the previous one, so this stays
    // correct for 29 February and 1 March starts.
    endDate: new Date(Date.UTC(year + 1, month - 1, day - 1)),
  };
}
