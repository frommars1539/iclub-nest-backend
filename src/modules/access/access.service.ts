import { Injectable } from '@nestjs/common';
import { nairobiMidnightUtc } from '../../common/nairobi-date';
import { PrismaService } from '../../prisma/prisma.service';
import { permissionsFor, type Permission } from './permissions';
import { resolveUnitScope, type UnitScope } from './unit-scope.rules';

export interface AccountAccess {
  memberId: string | null;
  clubId: string | null;
  permissions: Permission[];
  offices: string[];
}

/** The slice of a Member that access depends on. */
export interface MemberRef {
  id: string;
  clubId: string;
  status: string;
}

const NO_ACCESS: AccountAccess = {
  memberId: null,
  clubId: null,
  permissions: [],
  offices: [],
};

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** Looks the account's member up, then resolves its access. */
  async forAccount(
    accountId: string,
    now = new Date(),
  ): Promise<AccountAccess> {
    const account = await this.prisma.userAccount.findUnique({
      where: { id: accountId },
      select: { member: { select: { id: true, clubId: true, status: true } } },
    });
    return this.forMember(account?.member ?? null, now);
  }

  /**
   * Permissions come from the offices a member holds in a term running today
   * (FR-022/023), and only while the member is ACTIVE. They are read fresh
   * from the database on every request; nothing is cached or put in the
   * token, so a status change or an ended appointment takes effect at once.
   *
   * A member who is not ACTIVE keeps their identity (memberId, clubId) but
   * holds no permissions and no offices. The identity matters: the handover
   * party rule authorises by identity, so an outgoing leader who has since
   * been marked departed can still confirm their handover.
   */
  async forMember(
    member: MemberRef | null,
    now = new Date(),
  ): Promise<AccountAccess> {
    if (!member) return NO_ACCESS; // an account with no club has no permissions

    const identity = { memberId: member.id, clubId: member.clubId };
    if (member.status !== 'ACTIVE') {
      return { ...identity, permissions: [], offices: [] };
    }

    const today = nairobiMidnightUtc(now);
    const appointments = await this.prisma.appointment.findMany({
      where: {
        memberId: member.id,
        endedAt: null,
        term: { startDate: { lte: today }, endDate: { gte: today } },
      },
      select: { position: { select: { name: true, accessLevel: true } } },
    });

    return {
      ...identity,
      permissions: permissionsFor(
        appointments.map((a) => a.position.accessLevel),
      ),
      offices: appointments.map((a) => a.position.name),
    };
  }

  /**
   * The members this caller may act on for one permission(roster changes,
   * attendance marking). Read frsh on each call and only fro ACTIVE members.
   * Callers use it on writes only, so reads pay nothing.
   */

  async unitScopeFor(
    memberId: string,
    permission: Permission,
    now = new Date(),
  ): Promise<UnitScope> {
    const today = nairobiMidnightUtc(now);
    const appointments = await this.prisma.appointment.findMany({
      where: {
        memberId,
        endedAt: null,
        member: { status: 'ACTIVE' },
        term: { startDate: { lte: today }, endDate: { gte: today } },
      },
      select: { position: { select: { accessLevel: true, unitId: true } } },
    });
    return resolveUnitScope(
      appointments.map((a) => a.position),
      permission,
    );
  }
}
