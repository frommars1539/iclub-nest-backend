import { canActOnMember, NO_SCOPE, resolveUnitScope } from './unit-scope.rules';

const office = (accessLevel: string, unitId: string | null = null) => ({
  accessLevel,
  unitId,
});

describe('resolveUnitScope', () => {
  it('gives the administrator club-wide scope even if the position has a unit', () => {
    expect(
      resolveUnitScope([office('administrator', 'u1')], 'members.manage'),
    ).toEqual({ clubWide: true });
  });

  it('gives a club-wide officeholder (no unit) club-wide scope', () => {
    expect(
      resolveUnitScope([office('officeholder')], 'members.manage'),
    ).toEqual({ clubWide: true });
  });

  it('limits a unit officeholder to their unit', () => {
    expect(
      resolveUnitScope([office('officeholder', 'u1')], 'members.manage'),
    ).toEqual({ clubWide: false, unitIds: ['u1'] });
  });

  it('unions several units and drops duplicates', () => {
    expect(
      resolveUnitScope(
        [
          office('officeholder', 'u1'),
          office('officeholder', 'u2'),
          office('officeholder', 'u1'),
        ],
        'attendance.record',
      ),
    ).toEqual({ clubWide: false, unitIds: ['u1', 'u2'] });
  });

  it('lets a club-wide office that lacks the permission NOT widen the scope', () => {
    // Treasurer has no members.manage, so only the unit office counts.
    expect(
      resolveUnitScope(
        [office('officeholder', 'u1'), office('treasurer')],
        'members.manage',
      ),
    ).toEqual({ clubWide: false, unitIds: ['u1'] });
  });

  it('resolves to no scope when no held office grants the permission', () => {
    expect(resolveUnitScope([office('treasurer')], 'members.manage')).toEqual(
      NO_SCOPE,
    );
    expect(resolveUnitScope([office('patron')], 'attendance.record')).toEqual(
      NO_SCOPE,
    );
  });

  it('fails closed on an unrecognised access level', () => {
    expect(resolveUnitScope([office('wizard')], 'members.manage')).toEqual(
      NO_SCOPE,
    );
  });

  it('resolves to no scope when the caller holds no office', () => {
    expect(resolveUnitScope([], 'members.manage')).toEqual(NO_SCOPE);
  });
});

describe('canActOnMember', () => {
  it('lets club-wide scope act on anyone, including members with no unit', () => {
    expect(canActOnMember({ clubWide: true }, 'u9')).toBe(true);
    expect(canActOnMember({ clubWide: true }, null)).toBe(true);
  });

  it('lets a unit scope act only on members of its units', () => {
    const scope = { clubWide: false, unitIds: ['u1', 'u2'] } as const;
    expect(canActOnMember(scope, 'u1')).toBe(true);
    expect(canActOnMember(scope, 'u3')).toBe(false);
  });

  it('refuses a member with no unit for a unit scope', () => {
    expect(canActOnMember({ clubWide: false, unitIds: ['u1'] }, null)).toBe(
      false,
    );
  });

  it('refuses everyone for an empty scope', () => {
    expect(canActOnMember(NO_SCOPE, 'u1')).toBe(false);
    expect(canActOnMember(NO_SCOPE, null)).toBe(false);
  });
});
