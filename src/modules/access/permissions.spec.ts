import { PERMISSIONS, permissionsFor } from './permissions';

describe('permissionsFor', () => {
  it('gives an administrator every permission', () => {
    expect(permissionsFor(['administrator']).sort()).toEqual(
      [...PERMISSIONS].sort(),
    );
  });

  it('unions several offices without duplicates', () => {
    const granted = permissionsFor(['treasurer', 'patron']);
    expect(granted.sort()).toEqual(['finance.post', 'finance.view']);
  });

  it('grants nothing for an unrecognised level (fail closed)', () => {
    expect(permissionsFor(['superuser', 'constructor'])).toEqual([]);
  });

  it('grants nothing when no office is held', () => {
    expect(permissionsFor([])).toEqual([]);
  });
});
