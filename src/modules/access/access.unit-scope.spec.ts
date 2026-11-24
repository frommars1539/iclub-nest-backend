import { jest } from '@jest/globals';
import { nairobiMidnightUtc } from '../../common/nairobi-date';
import type { PrismaService } from '../../prisma/prisma.service';
import { AccessService } from './access.service';

const NOW = new Date('2026-11-21T10:00:00Z');

function setup(rows: Array<{ accessLevel: string; unitId: string | null }>) {
  const findMany = jest.fn<(args: unknown) => Promise<unknown[]>>(async () =>
    rows.map((position) => ({ position })),
  );
  const prisma = { appointment: { findMany } } as unknown as PrismaService;
  return { service: new AccessService(prisma), findMany };
}

describe('AccessService.unitScopeFor', () => {
  it('queries only current-term, not-ended appointments of an ACTIVE member', async () => {
    const { service, findMany } = setup([]);
    await service.unitScopeFor('mem1', 'members.manage', NOW);

    const today = nairobiMidnightUtc(NOW);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          memberId: 'mem1',
          endedAt: null,
          member: { status: 'ACTIVE' },
          term: { startDate: { lte: today }, endDate: { gte: today } },
        },
      }),
    );
  });

  it('returns the union of the unit offices that grant the permission', async () => {
    const { service } = setup([
      { accessLevel: 'officeholder', unitId: 'u1' },
      { accessLevel: 'officeholder', unitId: 'u2' },
      { accessLevel: 'treasurer', unitId: null },
    ]);
    await expect(
      service.unitScopeFor('mem1', 'members.manage', NOW),
    ).resolves.toEqual({ clubWide: false, unitIds: ['u1', 'u2'] });
  });

  it('returns club-wide for the administrator', async () => {
    const { service } = setup([{ accessLevel: 'administrator', unitId: null }]);
    await expect(
      service.unitScopeFor('mem1', 'attendance.record', NOW),
    ).resolves.toEqual({ clubWide: true });
  });

  it('returns an empty scope when the member holds no qualifying office', async () => {
    const { service } = setup([]);
    await expect(
      service.unitScopeFor('mem1', 'members.manage', NOW),
    ).resolves.toEqual({ clubWide: false, unitIds: [] });
  });
});
