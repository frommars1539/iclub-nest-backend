import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainException } from '../../common/errors/domain.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import type { EnvironmentVariables } from '../../config/env.validation';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { PasswordService } from '../auth/password.service';
import { publicUserSelect } from '../users/users.select';
import type { AcceptInvitationDto } from './dto/accept-invitation.dto';
import type { CreateInvitationDto } from './dto/create-invitation.dto';
import {
  ACCEPT_INVITATION_PATH,
  INVITATION_TTL_DAYS,
  INVITE_PERMISSION,
} from './invitation.constants';
import { invitationState } from './invitation.rules';
import {
  generateInvitationToken,
  hashInvitationToken,
} from './invitation-token';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly access: AccessService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  /** An officer invites an existing member of their own club to create an account. */
  async create(accountId: string, dto: CreateInvitationDto, now = new Date()) {
    const access = await this.access.forAccount(accountId, now);
    if (!access.clubId || !access.permissions.includes(INVITE_PERMISSION)) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'You do not have permission to invite members.',
        HttpStatus.FORBIDDEN,
      );
    }

    // Scoped to the caller's club, so another club's member looks like "not found".
    const member = await this.prisma.member.findFirst({
      where: { id: dto.memberId, clubId: access.clubId },
      select: { id: true, status: true, account: { select: { id: true } } },
    });
    if (!member) {
      throw new DomainException(
        ErrorCode.NOT_FOUND,
        'Member not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (member.account) {
      throw new DomainException(
        ErrorCode.MEMBER_HAS_ACCOUNT,
        'This member already has an account.',
      );
    }
    if (member.status !== 'ACTIVE') {
      throw new DomainException(
        ErrorCode.MEMBER_NOT_ACTIVE,
        'Only active members can be invited.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const emailTaken = await this.prisma.userAccount.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (emailTaken) {
      throw new DomainException(
        ErrorCode.EMAIL_TAKEN,
        'An account with that email already exists.',
      );
    }

    const { token, tokenHash } = generateInvitationToken();
    const expiresAt = new Date(now.getTime() + INVITATION_TTL_DAYS * DAY_MS);

    // Expire any older pending link for this member, then create the new one,
    // atomically: a member never has two live links.
    await this.prisma.$transaction([
      this.prisma.invitation.updateMany({
        where: {
          memberId: member.id,
          acceptedAt: null,
          expiresAt: { gt: now },
        },
        data: { expiresAt: now },
      }),
      this.prisma.invitation.create({
        data: {
          tokenHash,
          clubId: access.clubId,
          memberId: member.id,
          email: dto.email,
          expiresAt,
        },
      }),
    ]);

    const base = this.config
      .get('APP_URL', { infer: true })
      .replace(/\/+$/, '');
    return {
      link: `${base}${ACCEPT_INVITATION_PATH}?token=${encodeURIComponent(token)}`,
    };
  }

  /** What the accept page shows before the invitee chooses a password. */
  async getInfo(token: string, now = new Date()) {
    const invitation = await this.findUsable(token, now);
    return {
      email: invitation.email,
      memberName: invitation.member.fullName,
      clubName: invitation.club.name,
    };
  }

  /** Marks the invitation used and creates the member's account, atomically. */
  async accept({ token, password }: AcceptInvitationDto, now = new Date()) {
    const invitation = await this.findUsable(token, now);
    if (invitation.member.account) {
      throw new DomainException(
        ErrorCode.MEMBER_HAS_ACCOUNT,
        'This member already has an account.',
      );
    }

    // Hash before opening the transaction: Argon2 is slow, and a transaction
    // should stay as short as possible.
    const passwordHash = await this.passwords.hash(password);

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Claim the invitation only if it is still unused and unexpired.
        // Two simultaneous requests both pass findUsable; only one passes this.
        const claimed = await tx.invitation.updateMany({
          where: {
            tokenHash: invitation.tokenHash,
            acceptedAt: null,
            expiresAt: { gt: now },
          },
          data: { acceptedAt: now },
        });
        if (claimed.count !== 1) {
          throw new DomainException(
            ErrorCode.INVITATION_USED,
            'This invitation has already been used.',
          );
        }

        return tx.userAccount.create({
          data: {
            memberId: invitation.memberId,
            name: invitation.member.fullName,
            email: invitation.email,
            passwordHash,
          },
          select: publicUserSelect,
        });
      });
    } catch (error) {
      // The member-has-account case was checked above, so a unique
      // violation here is the email being taken in the meantime.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new DomainException(
          ErrorCode.EMAIL_TAKEN,
          'An account with that email already exists.',
        );
      }
      throw error;
    }
  }

  private async findUsable(token: string, now: Date) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: hashInvitationToken(token) },
      select: {
        tokenHash: true,
        memberId: true,
        email: true,
        acceptedAt: true,
        expiresAt: true,
        member: {
          select: { fullName: true, account: { select: { id: true } } },
        },
        club: { select: { name: true } },
      },
    });
    if (!invitation) {
      throw new DomainException(
        ErrorCode.INVITATION_INVALID,
        'This invitation link is not valid.',
        HttpStatus.NOT_FOUND,
      );
    }

    // Safe to distinguish: only someone holding a real 256-bit token reaches here.
    const state = invitationState(invitation, now);
    if (state === 'used') {
      throw new DomainException(
        ErrorCode.INVITATION_USED,
        'This invitation has already been used.',
      );
    }
    if (state === 'expired') {
      throw new DomainException(
        ErrorCode.INVITATION_EXPIRED,
        'This invitation has expired. Ask an officer for a new one.',
        HttpStatus.GONE,
      );
    }
    return invitation;
  }
}
