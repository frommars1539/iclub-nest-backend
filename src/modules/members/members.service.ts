import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainException } from '../../common/errors/domain.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { canActOnMember } from '../access/unit-scope.rules';
import type { CreateMemberDto } from './dto/create-member.dto';
import { toMemberResponse } from './members.mapper';

/** Who is calling. Built from AuthUser in the controller, never from the body. */
export interface MemberActor {
  accountId: string;
  memberId: string | null;
  clubId: string | null;
  name: string;
}

// Explicit selects: contact and joinDate are not part of the frontend's Member.
const MEMBER_SELECT = {
  id: true,
  memberNumber: true,
  fullName: true,
  unitId: true,
  status: true,
} as const;

const EVENT_SELECT = { id: true, at: true, actor: true, text: true } as const;

const forbidden = (message: string) =>
  new DomainException(ErrorCode.FORBIDDEN, message, HttpStatus.FORBIDDEN);

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  /** The caller's club register, each member with their history (oldest first). */
  async list(clubId: string | null) {
    if (!clubId) throw forbidden('You do not belong to a club.');

    const rows = await this.prisma.member.findMany({
      where: { clubId },
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
      select: {
        ...MEMBER_SELECT,
        events: {
          select: EVENT_SELECT,
          orderBy: [{ at: 'asc' }, { id: 'asc' }],
        },
      },
    });
    return rows.map((row) => toMemberResponse(row));
  }

  /**
   * Adds one member by hand. A unit officer may only add to their own unit;
   * a member with no unit can be added only by a club-wide office.
   */
  async create(actor: MemberActor, dto: CreateMemberDto, now = new Date()) {
    if (!actor.memberId || !actor.clubId) {
      throw forbidden('You do not belong to a club.');
    }
    const { memberId, clubId } = actor;
    const unitId = dto.unitId ?? null;

    // Scope first: it is cheap and needs no unit lookup. A unit officer who
    // names a unit outside their scope is refused whether or not it exists.
    const scope = await this.access.unitScopeFor(
      memberId,
      'members.manage',
      now,
    );
    if (!canActOnMember(scope, unitId)) {
      throw forbidden('Your office does not cover that unit.');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (unitId !== null) {
          const unit = await tx.unit.findFirst({
            where: { id: unitId, clubId, active: true },
            select: { id: true },
          });
          if (!unit) {
            throw new DomainException(
              ErrorCode.NOT_FOUND,
              'Unit not found.',
              HttpStatus.NOT_FOUND,
            );
          }
        }

        const member = await tx.member.create({
          data: {
            clubId,
            unitId,
            memberNumber: dto.memberNumber,
            fullName: dto.fullName,
            status: 'ACTIVE',
          },
          select: MEMBER_SELECT,
        });

        // actor is a name snapshot: it keeps reading correctly even if the
        // account is renamed later.
        const event = await tx.memberEvent.create({
          data: {
            clubId,
            memberId: member.id,
            actor: actor.name,
            text: 'Added to the register',
          },
          select: EVENT_SELECT,
        });

        await tx.auditEntry.create({
          data: {
            clubId,
            actorUserId: actor.accountId,
            action: 'member.created',
            entityType: 'member',
            entityId: member.id,
          },
        });

        return toMemberResponse({ ...member, events: [event] });
      });
    } catch (error) {
      // The only unique rule this insert can break is the member number, in
      // either index (exact or case-insensitive). Prisma doesn't know about
      // the expression index, so we deliberately don't inspect meta.target.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new DomainException(
          ErrorCode.MEMBER_NUMBER_TAKEN,
          'A member with this number already exists.',
          HttpStatus.CONFLICT,
          { field: 'memberNumber' },
        );
      }
      throw error;
    }
  }
}
