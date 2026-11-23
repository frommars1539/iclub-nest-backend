import { isMarkingOpen, isAmendment } from './attendance.rules';

const activity = {
  startsAt: new Date('2026-12-01T10:00:00Z'),
  endsAt: new Date('2026-12-01T11:00:00Z'),
  status: 'SCHEDULED' as const,
};

describe('isMarkingOpen', () => {
  it('is closed 21 minutes before start', () => {
    expect(isMarkingOpen(activity, new Date('2026-12-01T09:39:00Z'))).toBe(
      false,
    );
  });
  it('is open exactly 20 minutes before start', () => {
    expect(isMarkingOpen(activity, new Date('2026-12-01T09:40:00Z'))).toBe(
      true,
    );
  });
  it('is open after the activity ends', () => {
    expect(isMarkingOpen(activity, new Date('2026-12-01T12:00:00Z'))).toBe(
      true,
    );
  });
  it('is never open for a cancelled activity', () => {
    expect(
      isMarkingOpen(
        { ...activity, status: 'CANCELLED' },
        new Date('2026-12-01T10:30:00Z'),
      ),
    ).toBe(false);
  });
});

describe('isAmendment', () => {
  it('is false while the activity is running', () => {
    expect(isAmendment(activity, new Date('2026-12-01T10:30:00Z'))).toBe(false);
  });
  it('is true after it ends', () => {
    expect(isAmendment(activity, new Date('2026-12-01T11:01:00Z'))).toBe(true);
  });
});
