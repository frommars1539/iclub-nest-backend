import { provisionalTerm } from './club.rules';

const day = (date: Date) => date.toISOString().slice(0, 10);

describe('provisionalTerm', () => {
  it('starts today in Nairobi and ends the day before next year', () => {
    const term = provisionalTerm(new Date('2026-11-21T10:00:00Z'));
    expect(day(term.startDate)).toBe('2026-11-21');
    expect(day(term.endDate)).toBe('2027-11-20');
  });

  it('uses the Nairobi date, not the UTC date, late in the evening', () => {
    // 22:00 UTC is 01:00 the next day in Nairobi (UTC+3).
    const term = provisionalTerm(new Date('2026-11-21T22:00:00Z'));
    expect(day(term.startDate)).toBe('2026-11-22');
  });

  it('handles a 29 February start', () => {
    const term = provisionalTerm(new Date('2028-02-29T09:00:00Z'));
    expect(day(term.startDate)).toBe('2028-02-29');
    expect(day(term.endDate)).toBe('2029-02-28');
  });
});
