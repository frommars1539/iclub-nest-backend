import { PERMISSIONS, permissionsFor } from './permissions';

describe('permissionsFor', () => {
  it('gives an administrator every permission', () => {
    expect(permissionsFor(['administrator']).sort()).toEqual(
      [...PERMISSIONS].sort(),
    );
  });

  it('unions several offices without duplicates', () => {
    const granted = permissionsFor(['treasurer', 'patron']);
    expect(granted.sort()).toEqual([
      'finance.post',
      'finance.view',
      'members.view',
    ]);
  });

  it('lets every office read the roster; administrators and officeholders also change it', () => {
    for (const level of [
      'administrator',
      'treasurer',
      'officeholder',
      'patron',
    ]) {
      expect(permissionsFor([level])).toContain('members.view');
    }
    for (const level of ['administrator', 'officeholder']) {
      expect(permissionsFor([level])).toContain('members.manage');
    }
    for (const level of ['treasurer', 'patron']) {
      expect(permissionsFor([level])).not.toContain('members.manage');
    }
  });

  it('keeps roster import with the administrator only', () => {
    expect(permissionsFor(['administrator'])).toContain('members.import');
    for (const level of ['treasurer', 'officeholder', 'patron']) {
      expect(permissionsFor([level])).not.toContain('members.import');
    }
  });

  it('grants nothing for an unrecognised level (fail closed)', () => {
    expect(permissionsFor(['superuser', 'constructor'])).toEqual([]);
  });

  it('grants nothing when no office is held', () => {
    expect(permissionsFor([])).toEqual([]);
  });
});
