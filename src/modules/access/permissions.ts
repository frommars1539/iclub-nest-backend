export const PERMISSIONS = [
  'club.manage',
  'members.view',
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

/**
 * PROVISIONAL: mirrors the frontend's src/lib/permissions.ts; the team must
 * approve it. Every office can read the roster (members.view); the
 * administrator and officeholders (secretary, unit leaders) can also change
 * it. Only the administrator can import a roster.
 */
export const LEVEL_PERMISSIONS: Record<AccessLevel, readonly Permission[]> = {
  administrator: PERMISSIONS,
  treasurer: ['members.view', 'finance.view', 'finance.post'],
  officeholder: [
    'members.view',
    'members.manage',
    'activities.manage',
    'attendance.record',
    'records.manage',
  ],
  patron: ['members.view', 'finance.view'],
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

/** True when this access level grants the permission. An unknown level grants nothing. */
export function levelGrants(level: string, permission: Permission): boolean {
  return isAccessLevel(level) && LEVEL_PERMISSIONS[level].includes(permission);
}
