import { jest } from '@jest/globals';
import { ErrorCode } from '../../common/errors/error-codes';
import type { PrismaService } from '../../prisma/prisma.service';
import { HandoversService } from './handovers.service';

const NOW = new Date('2026-11-21T10:00:00Z');
const OPEN = {
  id: 'h1',
  outgoingMemberId: 'ada',
  incomingMemberId: 'bob',
  closedAt: null,
};

type State = {
  id: string;
  closedAt: Date | null;
  outgoingConfirmedAt: Date | null;
  incomingConfirmedAt: Date | null;
};

function setup(
  handover: unknown = OPEN,
  state: Partial<State> = {},
  unmarked = 0,
) {
  const db = {
    handover: {
      findFirst: jest.fn(async (): Promise<unknown> => handover),
      updateMany: jest.fn(async (): Promise<{ count: number }> => ({
        count: 1,
      })),
      findUniqueOrThrow: jest.fn(async (): Promise<State> => ({
        id: 'h1',
        closedAt: null,
        outgoingConfirmedAt: null,
        incomingConfirmedAt: null,
        ...state,
      })),
    },
    handoverItem: { count: jest.fn(async () => unmarked) },
    $transaction: async (work: unknown) =>
      Promise.all(work as Promise<unknown>[]),
  };
  return { db, service: new HandoversService(db as unknown as PrismaService) };
}

// Callers carry no permissions at all: the exception must not need any.
const caller = (memberId: string | null, clubId: string | null = 'club1') => ({
  memberId,
  clubId,
});

describe('HandoversService.confirm', () => {
  it('lets the outgoing party confirm, writing only the outgoing timestamp', async () => {
    const { db, service } = setup();
    await service.confirm(caller('ada'), 'h1', NOW);

    expect(db.handover.updateMany).toHaveBeenCalledTimes(1);
    expect(db.handover.updateMany).toHaveBeenCalledWith({
      where: { id: 'h1', closedAt: null, outgoingConfirmedAt: null },
      data: { outgoingConfirmedAt: NOW },
    });
  });

  it('lets the incoming party confirm, writing only the incoming timestamp', async () => {
    const { db, service } = setup();
    await service.confirm(caller('bob'), 'h1', NOW);

    expect(db.handover.updateMany).toHaveBeenCalledTimes(1);
    expect(db.handover.updateMany).toHaveBeenCalledWith({
      where: { id: 'h1', closedAt: null, incomingConfirmedAt: null },
      data: { incomingConfirmedAt: NOW },
    });
  });

  it('refuses a member of the club who is not a party, writing nothing', async () => {
    const { db, service } = setup();
    await expect(
      service.confirm(caller('eve'), 'h1', NOW),
    ).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
    });
    expect(db.handover.updateMany).not.toHaveBeenCalled();
  });

  it("looks the handover up inside the caller's club only", async () => {
    const { db, service } = setup(null);
    await expect(
      service.confirm(caller('ada'), 'h1', NOW),
    ).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
    });
    expect(db.handover.findFirst).toHaveBeenCalledWith({
      where: { id: 'h1', clubId: 'club1' },
      select: expect.anything(),
    });
  });

  it('treats a caller with no member or club as not found, without querying', async () => {
    const { db, service } = setup();
    await expect(
      service.confirm(caller(null, null), 'h1', NOW),
    ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
    expect(db.handover.findFirst).not.toHaveBeenCalled();
  });

  it('refuses a closed handover', async () => {
    const { db, service } = setup({ ...OPEN, closedAt: NOW });
    await expect(
      service.confirm(caller('ada'), 'h1', NOW),
    ).rejects.toMatchObject({
      code: ErrorCode.HANDOVER_CLOSED,
    });
    expect(db.handover.updateMany).not.toHaveBeenCalled();
  });

  it('reports readyToClose once both have confirmed and no item is unmarked', async () => {
    const { service } = setup(OPEN, {
      outgoingConfirmedAt: NOW,
      incomingConfirmedAt: NOW,
    });
    const result = await service.confirm(caller('bob'), 'h1', NOW);
    expect(result.readyToClose).toBe(true);
    expect(result.status).toBe('open');
  });

  it('is not ready to close while items are unmarked', async () => {
    const { service } = setup(
      OPEN,
      { outgoingConfirmedAt: NOW, incomingConfirmedAt: NOW },
      3,
    );
    const result = await service.confirm(caller('bob'), 'h1', NOW);
    expect(result.readyToClose).toBe(false);
    expect(result.unmarkedItems).toBe(3);
  });
});
