import { jest } from '@jest/globals';
import { ErrorCode } from '../../common/errors/error-codes';
import { Prisma } from '../../generated/prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AccessService } from '../access/access.service';
import type { UnitScope } from '../access/unit-scope.rules';
import { MembersService } from './members.service';

const actor = {
  accountId: 'acc1',
  memberId: 'm0',
  clubId: 'c1',
  name: 'Jeremy Owiti',
};
const dto = { memberNumber: 'CS/001', fullName: 'Amina Otieno', unitId: null };

const CLUB_WIDE: UnitScope = { clubWide: true };
const UNIT_ONLY: UnitScope = { clubWide: false, unitIds: ['u1'] };

type Fn = (args: unknown) => Promise<unknown>;

function build(
  scope: UnitScope,
  opts: { unitFound?: boolean; createError?: unknown } = {},
) {
  const unitFindFirst = jest
    .fn<Fn>()
    .mockResolvedValue(opts.unitFound === false ? null : { id: 'u1' });
  const memberCreate = jest.fn<Fn>();
  if (opts.createError) {
    memberCreate.mockRejectedValue(opts.createError);
  } else {
    memberCreate.mockResolvedValue({
      id: 'm1',
      memberNumber: 'CS/001',
      fullName: 'Amina Otieno',
      unitId: null,
      status: 'ACTIVE',
    });
  }
  const eventCreate = jest.fn<Fn>().mockResolvedValue({
    id: 'e1',
    at: new Date('2026-11-25T09:00:00.000Z'),
    actor: 'Jeremy Owiti',
    text: 'Added to the register',
  });
  const auditCreate = jest.fn<Fn>().mockResolvedValue({});
  const findMany = jest.fn<Fn>().mockResolvedValue([]);

  const tx = {
    unit: { findFirst: unitFindFirst },
    member: { create: memberCreate },
    memberEvent: { create: eventCreate },
    auditEntry: { create: auditCreate },
  };
  const transaction = jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) =>
    fn(tx),
  );
  const prisma = { $transaction: transaction, member: { findMany } };
  const unitScopeFor = jest
    .fn<(...args: unknown[]) => Promise<UnitScope>>()
    .mockResolvedValue(scope);

  const service = new MembersService(
    prisma as unknown as PrismaService,
    { unitScopeFor } as unknown as AccessService,
  );
  return {
    service,
    transaction,
    memberCreate,
    eventCreate,
    auditCreate,
    findMany,
    unitScopeFor,
  };
}

describe('MembersService.create', () => {
  it('adds a member, writes the history event and the audit entry', async () => {
    const t = build(CLUB_WIDE);
    const result = await t.service.create(actor, dto);

    expect(t.unitScopeFor).toHaveBeenCalledWith(
      'm0',
      'members.manage',
      expect.anything(),
    );
    expect(t.memberCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clubId: 'c1',
          unitId: null,
          memberNumber: 'CS/001',
          status: 'ACTIVE',
        }),
      }),
    );
    expect(t.eventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clubId: 'c1',
          memberId: 'm1',
          actor: 'Jeremy Owiti',
        }),
      }),
    );
    expect(t.auditCreate).toHaveBeenCalledWith({
      data: {
        clubId: 'c1',
        actorUserId: 'acc1',
        action: 'member.created',
        entityType: 'member',
        entityId: 'm1',
      },
    });
    expect(result).toEqual({
      id: 'm1',
      memberNumber: 'CS/001',
      fullName: 'Amina Otieno',
      unitId: null,
      status: 'active',
      history: [
        {
          id: 'e1',
          at: '2026-11-25T09:00:00.000Z',
          by: 'Jeremy Owiti',
          text: 'Added to the register',
        },
      ],
    });
  });

  it('refuses a unit officer adding a member with no unit', async () => {
    const t = build(UNIT_ONLY);
    await expect(t.service.create(actor, dto)).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
    });
    expect(t.transaction).not.toHaveBeenCalled();
  });

  it('refuses a unit officer adding to another unit', async () => {
    const t = build(UNIT_ONLY);
    await expect(
      t.service.create(actor, { ...dto, unitId: 'u2' }),
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
    expect(t.transaction).not.toHaveBeenCalled();
  });

  it('refuses a caller whose offices carry no scope', async () => {
    const t = build({ clubWide: false, unitIds: [] });
    await expect(
      t.service.create(actor, { ...dto, unitId: 'u1' }),
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
  });

  it('lets a unit officer add to their own unit', async () => {
    const t = build(UNIT_ONLY);
    await expect(
      t.service.create(actor, { ...dto, unitId: 'u1' }),
    ).resolves.toBeDefined();
  });

  it('returns NOT_FOUND for a unit that is missing, inactive or in another club', async () => {
    const t = build(CLUB_WIDE, { unitFound: false });
    await expect(
      t.service.create(actor, { ...dto, unitId: 'ghost' }),
    ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
    expect(t.memberCreate).not.toHaveBeenCalled();
  });

  it('maps a unique violation to MEMBER_NUMBER_TAKEN', async () => {
    const duplicate = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: 'test',
    });
    const t = build(CLUB_WIDE, { createError: duplicate });
    await expect(t.service.create(actor, dto)).rejects.toMatchObject({
      code: ErrorCode.MEMBER_NUMBER_TAKEN,
    });
  });

  it('rethrows errors it does not recognise', async () => {
    const t = build(CLUB_WIDE, { createError: new Error('boom') });
    await expect(t.service.create(actor, dto)).rejects.toThrow('boom');
  });

  it('refuses an account that has no member', async () => {
    const t = build(CLUB_WIDE);
    await expect(
      t.service.create({ ...actor, memberId: null }, dto),
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
  });
});

describe('MembersService.list', () => {
  it("queries only the caller's club, with history oldest first", async () => {
    const t = build(CLUB_WIDE);
    await t.service.list('c1');
    expect(t.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clubId: 'c1' } }),
    );
  });

  it('refuses an account with no club', async () => {
    const t = build(CLUB_WIDE);
    await expect(t.service.list(null)).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
    });
    expect(t.findMany).not.toHaveBeenCalled();
  });
});
