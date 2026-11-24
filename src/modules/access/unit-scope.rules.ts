import { levelGrants, type Permission } from './permissions';

/**
 * Which members a caller may act on. Club-wide offices and the administrator
 * reach every member; a unit officer reaches only members of their unit(s).
 * Roster changes and attendance marking both use this one rule.
 */
export type UnitScope =
  { clubWide: true } | { clubWide: false; unitIds: readonly string[] };

/** Acts on nobody. This is what "no qualifying office" resolves to (fail closed). */
export const NO_SCOPE: UnitScope = { clubWide: false, unitIds: [] };

/** The slice of a held office that scope depends on. */
export interface HeldOffice {
  accessLevel: string;
  unitId: string | null;
}

/**
 * Resolves scope for ONE permission. Only offices whose level grants that
 * permission count, so a club-wide Treasurer office cannot widen the scope of
 * someone who is also a unit officeholder.
 */
export function resolveUnitScope(
  offices: readonly HeldOffice[],
  permission: Permission,
): UnitScope {
  const unitIds = new Set<string>();
  for (const office of offices) {
    if (!levelGrants(office.accessLevel, permission)) continue;
    // The administrator is always club-wide, even if the position has a unitId.
    if (office.accessLevel === 'administrator' || office.unitId === null) {
      return { clubWide: true };
    }
    unitIds.add(office.unitId);
  }
  return unitIds.size === 0
    ? NO_SCOPE
    : { clubWide: false, unitIds: [...unitIds] };
}

/** Per-member check. A member with no unit can be reached only club-wide. */
export function canActOnMember(
  scope: UnitScope,
  memberUnitId: string | null,
): boolean {
  if (scope.clubWide) return true;
  if (memberUnitId === null) return false;
  return scope.unitIds.includes(memberUnitId);
}
