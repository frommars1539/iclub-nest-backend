import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainException } from '../../common/errors/domain.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../auth/auth-user';
import { isReadyToClose, partyRoles } from './handover.rules';

const notFound = () =>
  new DomainException(
    ErrorCode.NOT_FOUND,
    'Handover not found.',
    HttpStatus.NOT_FOUND,
  );

@Injectable()
export class HandoversService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * THE HANDOVER-PARTY EXCEPTION. Authorised by being the named outgoing or
   * incoming member of this handover, NOT by a permission: an outgoing
   * leader's term has ended, so they hold no permissions, yet they must still
   * be able to confirm what they handed over. It grants this one action on
   * this one handover and nothing else.
   */
  async confirm(
    caller: Pick<AuthUser, 'memberId' | 'clubId'>,
    handoverId: string,
    now = new Date(),
  ) {
    if (!caller.memberId || !caller.clubId) throw notFound();

    // Scoped to the caller's club: another club's handover is "not found".
    const handover = await this.prisma.handover.findFirst({
      where: { id: handoverId, clubId: caller.clubId },
      select: {
        id: true,
        outgoingMemberId: true,
        incomingMemberId: true,
        closedAt: true,
      },
    });
    if (!handover) throw notFound();

    const roles = partyRoles(handover, caller.memberId);
    if (!roles.outgoing && !roles.incoming) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'Only the outgoing or incoming holder can confirm this handover.',
        HttpStatus.FORBIDDEN,
      );
    }
    if (handover.closedAt) {
      throw new DomainException(
        ErrorCode.HANDOVER_CLOSED,
        'This handover is closed and cannot be changed.',
      );
    }

    // Each side writes only its own timestamp, and only if still unset, so
    // confirming twice keeps the original time. `closedAt: null` also stops
    // a write racing with a close.
    const writes: Prisma.PrismaPromise<Prisma.BatchPayload>[] = [];
    if (roles.outgoing) {
      writes.push(
        this.prisma.handover.updateMany({
          where: { id: handover.id, closedAt: null, outgoingConfirmedAt: null },
          data: { outgoingConfirmedAt: now },
        }),
      );
    }
    if (roles.incoming) {
      writes.push(
        this.prisma.handover.updateMany({
          where: { id: handover.id, closedAt: null, incomingConfirmedAt: null },
          data: { incomingConfirmedAt: now },
        }),
      );
    }
    await this.prisma.$transaction(writes);

    const [state, unmarkedItems] = await Promise.all([
      this.prisma.handover.findUniqueOrThrow({
        where: { id: handover.id },
        select: {
          id: true,
          closedAt: true,
          outgoingConfirmedAt: true,
          incomingConfirmedAt: true,
        },
      }),
      this.prisma.handoverItem.count({
        where: { handoverId: handover.id, disposition: null },
      }),
    ]);

    return {
      id: state.id,
      status: state.closedAt ? 'closed' : 'open',
      outgoingConfirmedAt: state.outgoingConfirmedAt,
      incomingConfirmedAt: state.incomingConfirmedAt,
      unmarkedItems,
      readyToClose: isReadyToClose(state, unmarkedItems),
    };
  }
}
