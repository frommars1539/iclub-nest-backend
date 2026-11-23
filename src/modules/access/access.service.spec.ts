import { jest } from '@jest/globals';
import type { PrismaService } from '../../prisma/prisma.service';
import { AccessService } from './access.service';

function setup(
  appointments: { position: { name: string; accessLevel: string } }[],
) {
  const findMany = jest.fn(async () => appointments);
  const prisma = { appointment: { findMany } } as unknown as PrismaService;
  return { service: new AccessService(prisma), findMany };
}

describe('AccessService.forMember', () => {
  it('gives a club-less account no access and does not query appointments', async () => {
    const { service, findMany } = setup([]);
    const access = await service.forMember(null);
    expect(access).toEqual({
      memberId: null,
      clubId: null,
      permissions: [],
      offices: [],
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('derives permissions and office names from the held positions', async () => {
    const { service } = setup([
      { position: { name: 'Treasurer', accessLevel: 'treasurer' } },
    ]);
    const access = await service.forMember({ id: 'm1', clubId: 'c1' });
    expect(access.clubId).toBe('c1');
    expect(access.offices).toEqual(['Treasurer']);
    expect(access.permissions.sort()).toEqual(['finance.post', 'finance.view']);
  });

  it('grants nothing for an unrecognised access level', async () => {
    const { service } = setup([
      { position: { name: 'Odd', accessLevel: 'superuser' } },
    ]);
    const access = await service.forMember({ id: 'm1', clubId: 'c1' });
    expect(access.permissions).toEqual([]);
  });

  it('only counts active appointments in a term running today in Nairobi', async () => {
    const { service, findMany } = setup([]);
    // 22:00 UTC on the 21st is already the 22nd in Nairobi.
    await service.forMember(
      { id: 'm1', clubId: 'c1' },
      new Date('2026-11-21T22:00:00Z'),
    );
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
