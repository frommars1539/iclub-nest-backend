import { jest } from '@jest/globals';
import { ErrorCode } from '../../common/errors/error-codes';
import type { PrismaService } from '../../prisma/prisma.service';
import { LoginThrottleService } from './login-throttle.service';
import { loginKey, windowStart } from './login-throttle.rules';

const NOW = new Date('2026-11-21T10:00:00Z');
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);
const EMAIL = 'ada@example.com';

function setup(failureTimes: Date[] = []) {
  const db = {
    loginFailure: {
      findMany: jest.fn(async (): Promise<{ at: Date }[]> =>
        failureTimes.map((at) => ({ at })),
      ),
      deleteMany: jest.fn(async () => ({ count: 0 })),
      create: jest.fn(async () => ({})),
    },
    $transaction: async (work: unknown) =>
      Promise.all(work as Promise<unknown>[]),
  };
  return {
    db,
    service: new LoginThrottleService(db as unknown as PrismaService),
  };
}

describe('LoginThrottleService', () => {
  it('allows an account with fewer than 10 recent failures', async () => {
    const { db, service } = setup([ago(0), ago(1)]);
    await expect(service.assertAllowed(EMAIL, NOW)).resolves.toBeUndefined();
    expect(db.loginFailure.findMany).toHaveBeenCalledWith({
      where: { keyHash: loginKey(EMAIL), at: { gt: windowStart(NOW) } },
      orderBy: { at: 'desc' },
      take: 10,
      select: { at: true },
    });
  });

  it('blocks with RATE_LIMITED and says how long to wait', async () => {
    const ten = [0, 1, 1, 2, 2, 3, 3, 4, 4, 5].map(ago);
    const { service } = setup(ten);
    await expect(service.assertAllowed(EMAIL, NOW)).rejects.toMatchObject({
      code: ErrorCode.RATE_LIMITED,
      details: { retryAfterSeconds: 600 },
    });
  });

  it('records a failure and drops that key’s expired rows', async () => {
    const { db, service } = setup();
    await service.recordFailure(EMAIL, NOW);
    expect(db.loginFailure.deleteMany).toHaveBeenCalledWith({
      where: { keyHash: loginKey(EMAIL), at: { lte: windowStart(NOW) } },
    });
    expect(db.loginFailure.create).toHaveBeenCalledWith({
      data: { keyHash: loginKey(EMAIL), at: NOW },
    });
  });

  it('never writes the email address itself (NFR-050)', async () => {
    const { db, service } = setup();
    await service.recordFailure(EMAIL, NOW);
    expect(JSON.stringify(db.loginFailure.create.mock.calls)).not.toContain(
      EMAIL,
    );
  });

  it('clears the failures for that key on reset', async () => {
    const { db, service } = setup();
    await service.reset(EMAIL);
    expect(db.loginFailure.deleteMany).toHaveBeenCalledWith({
      where: { keyHash: loginKey(EMAIL) },
    });
  });
});
