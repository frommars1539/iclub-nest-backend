import {
  API_MEMBER_STATUSES,
  DB_MEMBER_STATUSES,
  describeStatusChange,
  fromApiStatus,
  isStatusChange,
  losesAccess,
  memberNumberToApi,
  normaliseMemberNumber,
  toApiStatus,
} from './members.rules';

describe('status mapping', () => {
  it('maps every database status to the frontend vocabulary', () => {
    expect(toApiStatus('ACTIVE')).toBe('active');
    expect(toApiStatus('INACTIVE')).toBe('inactive');
    expect(toApiStatus('DEPARTED')).toBe('departing');
  });

  it('maps every frontend status back to the database', () => {
    expect(fromApiStatus('active')).toBe('ACTIVE');
    expect(fromApiStatus('inactive')).toBe('INACTIVE');
    expect(fromApiStatus('departing')).toBe('DEPARTED');
  });

  it('round-trips every status in both directions', () => {
    for (const db of DB_MEMBER_STATUSES) {
      expect(fromApiStatus(toApiStatus(db))).toBe(db);
    }
    for (const api of API_MEMBER_STATUSES) {
      expect(toApiStatus(fromApiStatus(api))).toBe(api);
    }
  });

  it('has the same number of statuses on both sides', () => {
    expect(API_MEMBER_STATUSES).toHaveLength(DB_MEMBER_STATUSES.length);
  });
});

describe('normaliseMemberNumber', () => {
  it('trims surrounding whitespace', () => {
    expect(normaliseMemberNumber('  CS/001/2023 ')).toBe('CS/001/2023');
  });

  it('keeps case and inner characters as typed', () => {
    expect(normaliseMemberNumber('cs/001 b')).toBe('cs/001 b');
  });

  it('turns empty, blank, null and undefined into null', () => {
    expect(normaliseMemberNumber('')).toBeNull();
    expect(normaliseMemberNumber('   ')).toBeNull();
    expect(normaliseMemberNumber(null)).toBeNull();
    expect(normaliseMemberNumber(undefined)).toBeNull();
  });
});

describe('memberNumberToApi', () => {
  it('serialises null as an empty string', () => {
    expect(memberNumberToApi(null)).toBe('');
  });

  it('passes a stored number through', () => {
    expect(memberNumberToApi('A12')).toBe('A12');
  });
});

describe('status change rules', () => {
  it('detects a no-op change', () => {
    expect(isStatusChange('ACTIVE', 'ACTIVE')).toBe(false);
    expect(isStatusChange('ACTIVE', 'INACTIVE')).toBe(true);
    expect(isStatusChange('DEPARTED', 'ACTIVE')).toBe(true);
  });

  it('says only moves away from ACTIVE lose access', () => {
    expect(losesAccess('ACTIVE')).toBe(false);
    expect(losesAccess('INACTIVE')).toBe(true);
    expect(losesAccess('DEPARTED')).toBe(true);
  });

  it('records both statuses in the event text', () => {
    expect(describeStatusChange('ACTIVE', 'DEPARTED')).toBe(
      'Status changed from active to departing.',
    );
    expect(describeStatusChange('INACTIVE', 'ACTIVE')).toBe(
      'Status changed from inactive to active.',
    );
  });
});
