/**
 * Pure rules for the members module: no Nest, no Prisma, no I/O.
 *
 * The status types are declared here as plain string unions instead of being
 * imported from the generated Prisma client. A Prisma enum is just a union
 * of the same string literals, so Prisma's MemberStatus is assignable to
 * DbMemberStatus. That keeps this file free of any import path I haven't seen.
 */

export const DB_MEMBER_STATUSES = ['ACTIVE', 'INACTIVE', 'DEPARTED'] as const;
export type DbMemberStatus = (typeof DB_MEMBER_STATUSES)[number];

export const API_MEMBER_STATUSES = ['active', 'departing', 'inactive'] as const;
export type ApiMemberStatus = (typeof API_MEMBER_STATUSES)[number];

// Record<Union, ...> forces every member of the union to appear as a key.
// If someone adds a status to the enum later, this stops compiling until the
// mapping is extended, so a status can't silently fall through.
const DB_TO_API: Record<DbMemberStatus, ApiMemberStatus> = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  DEPARTED: 'departing',
};

const API_TO_DB: Record<ApiMemberStatus, DbMemberStatus> = {
  active: 'ACTIVE',
  inactive: 'INACTIVE',
  departing: 'DEPARTED',
};

export function toApiStatus(status: DbMemberStatus): ApiMemberStatus {
  return DB_TO_API[status];
}

export function fromApiStatus(status: ApiMemberStatus): DbMemberStatus {
  return API_TO_DB[status];
}

/**
 * Member numbers are trimmed and nothing else (no case folding) until the
 * mock handlers show otherwise. An empty or whitespace-only value becomes
 * null: Postgres treats NULLs as distinct in the (club_id, member_number)
 * unique index, but two stored '' values would collide with each other.
 */
export function normaliseMemberNumber(
  raw: string | null | undefined,
): string | null {
  const trimmed = raw?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

/** The frontend's Member.memberNumber is a string, so null goes out as ''. */
export function memberNumberToApi(stored: string | null): string {
  return stored ?? '';
}

export function isStatusChange(
  from: DbMemberStatus,
  to: DbMemberStatus,
): boolean {
  return from !== to;
}

/**
 * True when moving to this status would take the member out of ACTIVE.
 * Only ACTIVE members hold permissions, so these moves must be refused
 * while the member holds a current office (MEMBER_HOLDS_OFFICE).
 */
export function losesAccess(next: DbMemberStatus): boolean {
  return next !== 'ACTIVE';
}

/**
 * Text for the MemberEvent row. It uses the frontend's vocabulary because
 * the frontend prints this text as written in the member's history.
 */
export function describeStatusChange(
  from: DbMemberStatus,
  to: DbMemberStatus,
): string {
  return `Status changed from ${toApiStatus(from)} to ${toApiStatus(to)}.`;
}
