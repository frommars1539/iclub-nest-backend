import { jest } from '@jest/globals';
import { DomainException } from '../../common/errors/domain.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { Prisma } from '../../generated/prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { ClubsService } from './clubs.service';

type Account = { id: string; name: string; memberId: string | null };

function setup() {
  const tx = {
    userAccount: {
      findUnique: jest.fn(async (): Promise<Account | null> => ({
        id: 'acc1',
        name: 'Jeremy Owiti',
        memberId: null,
      })),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    club: {
      create: jest.fn(async () => ({
        id: 'club1',
        name: 'Lish Club',
        shortCode: 'LISH',
        purpose: 'Testing',
        foundingDate: new Date('2020-01-01T00:00:00Z'),
        setupStatus: 'in_progress',
      })),
    },
    member: { create: jest.fn(async () => ({ id: 'mem1' })) },
    term: {
      create: jest.fn(async () => ({
        id: 'term1',
        name: 'First term',
        startDate: new Date('2026-11-21T00:00:00Z'),
        endDate: new Date('2027-11-20T00:00:00Z'),
      })),
    },
    position: {
      create: jest.fn(async () => ({
        id: 'pos1',
        name: 'Administrator',
        requiredOffice: true,
        inVerifiedRoster: false,
        accessLevel: 'administrator',
      })),
    },
    appointment: { create: jest.fn(async () => ({ id: 'app1' })) },
  };
  const prisma = {
    $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
  } as unknown as PrismaService;
  return { tx, service: new ClubsService(prisma) };
}

const dto = {
  name: 'Lish Club',
  shortCode: 'LISH',
  purpose: 'Testing',
  foundingDate: '2020-01-01',
};

describe('ClubsService.createClub', () => {
  it('creates the club, member, term, office and appointment, and links the account', async () => {
    const { tx, service } = setup();

    const club = await service.createClub('acc1', dto);

    expect(club.setupStatus).toBe('in_progress');
    expect(club.foundingDate).toBe('2020-01-01');
    expect(club.term).toEqual({
      name: 'First term',
      startDate: '2026-11-21',
      endDate: '2027-11-20',
    });
    expect(tx.position.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accessLevel: 'administrator',
        requiredOffice: true,
      }),
    });
    expect(tx.appointment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        memberId: 'mem1',
        appointedBy: 'mem1',
        positionId: 'pos1',
        termId: 'term1',
      }),
    });
    expect(tx.userAccount.updateMany).toHaveBeenCalledWith({
      where: { id: 'acc1', memberId: null },
      data: { memberId: 'mem1' },
    });
  });

  it('refuses an account that already belongs to a club, creating nothing', async () => {
    const { tx, service } = setup();
    tx.userAccount.findUnique.mockResolvedValueOnce({
      id: 'acc1',
      name: 'Jeremy Owiti',
      memberId: 'existing',
    });

    await expect(service.createClub('acc1', dto)).rejects.toMatchObject({
      code: ErrorCode.ACCOUNT_HAS_CLUB,
    });
    expect(tx.club.create).not.toHaveBeenCalled();
  });

  it('refuses when a concurrent request claimed the account first', async () => {
    const { tx, service } = setup();
    tx.userAccount.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.createClub('acc1', dto)).rejects.toBeInstanceOf(
      DomainException,
    );
    expect(tx.appointment.create).not.toHaveBeenCalled();
  });

  it('maps a duplicate short code to SHORT_CODE_TAKEN', async () => {
    const { tx, service } = setup();
    tx.club.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(service.createClub('acc1', dto)).rejects.toMatchObject({
      code: ErrorCode.SHORT_CODE_TAKEN,
    });
  });
});
