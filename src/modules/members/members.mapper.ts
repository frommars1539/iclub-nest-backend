import {
  memberNumberToApi,
  toApiStatus,
  type DbMemberStatus,
} from './members.rules';

/** The slice of a Member row (with its events) that the API response needs. */
export interface MemberRow {
  id: string;
  memberNumber: string | null;
  fullName: string;
  unitId: string | null;
  status: DbMemberStatus;
  events: readonly { id: string; at: Date; actor: string; text: string }[];
}

/** Mirrors the frontend's Member type exactly. */
export interface MemberResponse {
  id: string;
  memberNumber: string;
  fullName: string;
  unitId: string | null;
  status: 'active' | 'departing' | 'inactive';
  history: { id: string; at: string; by: string; text: string }[];
}

export function toMemberResponse(row: MemberRow): MemberResponse {
  return {
    id: row.id,
    memberNumber: memberNumberToApi(row.memberNumber),
    fullName: row.fullName,
    unitId: row.unitId,
    status: toApiStatus(row.status),
    history: row.events.map((e) => ({
      id: e.id,
      at: e.at.toISOString(),
      by: e.actor,
      text: e.text,
    })),
  };
}
