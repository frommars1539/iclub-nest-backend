export const PERMISSIONS = [
  'club.manage',
  'members.manage',
  'members.import',
  'leadership.manage',
  'activities.manage',
  'attendance.record',
  'finance.view',
  'finance.post',
  'records.manage',
  'handover.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ACCESS_LEVELS = [
  'administrator',
  'treasurer',
  'officeholder',
  'patron',
] as const;

export type AccessLevel = (typeof ACCESS_LEVELS)[number];

/** PROVISIONAL: mirrors the frontend's src/lib/permissions.ts; the team must approve it. */
export const LEVEL_PERMISSIONS: Record<AccessLevel, readonly Permission[]> = {
  administrator: PERMISSIONS,
  treasurer: ['finance.view', 'finance.post'],
  officeholder: ['activities.manage', 'attendance.record', 'records.manage'],
  patron: ['finance.view'],
};

const isAccessLevel = (value: string): value is AccessLevel =>
  (ACCESS_LEVELS as readonly string[]).includes(value);

/**
 * The union of what each access level grants. `Position.accessLevel` is a
 * free-text column, so an unrecognised value grants nothing: fail closed.
 */
export function permissionsFor(levels: readonly string[]): Permission[] {
  const granted = new Set<Permission>();
  for (const level of levels) {
    if (!isAccessLevel(level)) continue;
    for (const permission of LEVEL_PERMISSIONS[level]) granted.add(permission);
  }
  return [...granted];
}
