import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainException } from '../../common/errors/domain.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ADMIN_ACCESS_LEVEL,
  ADMIN_POSITION_NAME,
  CLUB_SETUP_STATUS_INITIAL,
} from './club.constants';
import { provisionalTerm } from './club.rules';
import type { CreateClubDto } from './dto/create-club.dto';

const toDay = (date: Date) => date.toISOString().slice(0, 10);

@Injectable()
export class ClubsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * FR-001. Creates the club, its first member (the registrant), a
   * provisional term, the administrator office and the appointment, all in
   * one transaction: either everything exists or nothing does.
   */
  async createClub(accountId: string, dto: CreateClubDto, now = new Date()) {
    const term = provisionalTerm(now);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const account = await tx.userAccount.findUnique({
          where: { id: accountId },
          select: { id: true, name: true, memberId: true },
        });
        if (!account) {
          throw new DomainException(
            ErrorCode.UNAUTHENTICATED,
            'Account not found.',
            HttpStatus.UNAUTHORIZED,
          );
        }
        if (account.memberId) {
          throw new DomainException(
            ErrorCode.ACCOUNT_HAS_CLUB,
            'This account already belongs to a club.',
          );
        }

        const club = await tx.club.create({
          data: {
            name: dto.name,
            shortCode: dto.shortCode,
            purpose: dto.purpose,
            foundingDate: new Date(`${dto.foundingDate}T00:00:00Z`),
            setupStatus: CLUB_SETUP_STATUS_INITIAL,
          },
        });

        const member = await tx.member.create({
          data: { clubId: club.id, fullName: account.name, status: 'ACTIVE' },
        });

        // Claim the account only if it is still club-less. The check above
        // can race with a second request; this write cannot.
        const claimed = await tx.userAccount.updateMany({
          where: { id: account.id, memberId: null },
          data: { memberId: member.id },
        });
        if (claimed.count !== 1) {
          throw new DomainException(
            ErrorCode.ACCOUNT_HAS_CLUB,
            'This account already belongs to a club.',
          );
        }

        const termRow = await tx.term.create({
          data: {
            clubId: club.id,
            name: term.name,
            startDate: term.startDate,
            endDate: term.endDate,
          },
        });

        const position = await tx.position.create({
          data: {
            clubId: club.id,
            name: ADMIN_POSITION_NAME,
            requiredOffice: true,
            accessLevel: ADMIN_ACCESS_LEVEL,
          },
        });

        await tx.appointment.create({
          data: {
            clubId: club.id,
            positionId: position.id,
            memberId: member.id,
            termId: termRow.id,
            appointedBy: member.id, // the registrant appoints themselves
            basis: 'APPOINTED',
          },
        });

        // Shaped like the frontend's `Club` type.
        return {
          id: club.id,
          name: club.name,
          shortCode: club.shortCode,
          purpose: club.purpose,
          foundingDate: club.foundingDate ? toDay(club.foundingDate) : null,
          units: [],
          positions: [
            {
              id: position.id,
              name: position.name,
              unitId: null,
              requiredOffice: position.requiredOffice,
              inVerifiedRoster: position.inVerifiedRoster,
              accessLevel: position.accessLevel,
            },
          ],
          term: {
            name: termRow.name,
            startDate: toDay(termRow.startDate),
            endDate: toDay(termRow.endDate),
          },
          setupStatus: club.setupStatus,
        };
      });
    } catch (error) {
      // The only unique key this transaction can violate is the short code:
      // the other inserts are into fresh rows of a club that did not exist.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new DomainException(
          ErrorCode.SHORT_CODE_TAKEN,
          'That short code is already taken.',
          HttpStatus.CONFLICT,
          { field: 'shortCode' },
        );
      }
      throw error;
    }
  }
}
