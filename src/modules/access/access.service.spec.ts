import { jest } from '@jest/globals';
import type { PrismaService } from '../../prisma/prisma.service';
import { AccessService } from './access.service';

function setup(
  appointments: { position: { name: string; accessLevel: string } }[] = [],
) {
  const findMany = jest.fn(async () => appointments);
  const prisma = { appointment: { findMany } } as unknown as PrismaService;
  return { service: new AccessService(prisma), findMany };
}

const ACTIVE = { id: 'm1', clubId: 'c1', status: 'ACTIVE' };

describe('AccessService.forMember', () => {
  it('gives a club-less account no access and does not query appointments', async () => {
    const { service, findMany } = setup();
    expect(await service.forMember(null)).toEqual({
      memberId: null,
      clubId: null,
      permissions: [],
      offices: [],
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it.each(['INACTIVE', 'DEPARTED'])(
    'keeps the identity but grants nothing to a %s member, even one holding an office',
    async (status) => {
      const { service, findMany } = setup([
        { position: { name: 'Administrator', accessLevel: 'administrator' } },
      ]);
      const access = await service.forMember({ ...ACTIVE, status });
      expect(access).toEqual({
        memberId: 'm1',
        clubId: 'c1',
        permissions: [],
        offices: [],
      });
      expect(findMany).not.toHaveBeenCalled();
    },
  );

  it('gives an active member who holds no office no permissions (authority attaches to the office)', async () => {
    const { service } = setup([]);
    const access = await service.forMember(ACTIVE);
    expect(access.permissions).toEqual([]);
    expect(access.offices).toEqual([]);
    expect(access.memberId).toBe('m1');
  });

  it('derives permissions and office names from the held offices', async () => {
    const { service } = setup([
      { position: { name: 'Treasurer', accessLevel: 'treasurer' } },
    ]);
    const access = await service.forMember(ACTIVE);
    expect(access.offices).toEqual(['Treasurer']);
    expect([...access.permissions].sort()).toEqual([
      'finance.post',
      'finance.view',
      'members.view',
    ]);
  });

  it('grants nothing for an unrecognised access level', async () => {
    const { service } = setup([
      { position: { name: 'Odd', accessLevel: 'superuser' } },
    ]);
    const access = await service.forMember(ACTIVE);
    expect(access.permissions).toEqual([]);
  });

  it('only counts active appointments in a term running today in Nairobi', async () => {
    const { service, findMany } = setup();
    // 22:00 UTC on the 21st is already the 22nd in Nairobi.
    await service.forMember(ACTIVE, new Date('2026-11-21T22:00:00Z'));
    const day = new Date('2026-11-22T00:00:00Z');
    expect(findMany).toHaveBeenCalledWith({
      where: {
        memberId: 'm1',
        endedAt: null,
        term: { startDate: { lte: day }, endDate: { gte: day } },
      },
      select: expect.anything(),
    });
  });
});
