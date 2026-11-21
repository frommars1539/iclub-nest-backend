import { Injectable } from '@nestjs/common';
import { nairobiMidnightUtc } from '../../common/nairobi-date';
import { PrismaService } from '../../prisma/prisma.service';
import { permissionsFor, type Permission } from './permissions';

export interface AccountAccess {
  memberId: string | null;
  clubId: string | null;
  permissions: Permission[];
  offices: string[];
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

  /**
   * Permissions come from the offices the account's member holds in a term
   * that is running today (FR-022/023), read fresh from the database every
   * time. Nothing is cached or put in the token, so an ended appointment
   * stops granting access immediately.
   */
  async forAccount(
    accountId: string,
    now = new Date(),
  ): Promise<AccountAccess> {
    const account = await this.prisma.userAccount.findUnique({
      where: { id: accountId },
      select: { member: { select: { id: true, clubId: true } } },
    });
    const member = account?.member;
    if (!member) return NO_ACCESS; // an account with no club has no permissions

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
      memberId: member.id,
      clubId: member.clubId,
      permissions: permissionsFor(
        appointments.map((a) => a.position.accessLevel),
      ),
      offices: appointments.map((a) => a.position.name),
    };
  }
}
