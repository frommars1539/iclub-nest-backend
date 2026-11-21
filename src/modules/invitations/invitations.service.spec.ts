import { jest } from '@jest/globals';
import type { ConfigService } from '@nestjs/config';
import { ErrorCode } from '../../common/errors/error-codes';
import type { EnvironmentVariables } from '../../config/env.validation';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AccessService, AccountAccess } from '../access/access.service';
import type { PasswordService } from '../auth/password.service';
import { hashInvitationToken } from './invitation-token';
import { InvitationsService } from './invitations.service';

const NOW = new Date('2026-11-21T10:00:00Z');

function setup(access: Partial<AccountAccess> = {}) {
  const accessService = {
    forAccount: jest.fn(async (): Promise<AccountAccess> => ({
      memberId: 'm0',
      clubId: 'club1',
      permissions: ['leadership.manage'],
      offices: ['Administrator'],
      ...access,
    })),
  };
  const tx = {
    userAccount: {
      findUnique: jest.fn(async (): Promise<unknown> => null),
      create: jest.fn(async (args: unknown): Promise<unknown> => args),
    },
    invitation: {
      findUnique: jest.fn(async (): Promise<unknown> => null),
      updateMany: jest.fn(async (): Promise<{ count: number }> => ({
        count: 1,
      })),
      create: jest.fn(async (args: unknown): Promise<unknown> => args),
    },
  };
  const db = {
    ...tx,
    member: {
      findFirst: jest.fn(async (): Promise<unknown> => ({
        id: 'mem1',
        status: 'ACTIVE',
        account: null,
      })),
    },
    $transaction: async (work: unknown): Promise<unknown> =>
      Array.isArray(work)
        ? Promise.all(work)
        : (work as (client: unknown) => Promise<unknown>)(tx),
  };
  const passwords = {
    hash: jest.fn(async () => 'HASHED'),
  } as unknown as PasswordService;
  const config = {
    get: () => 'http://localhost:3000',
  } as unknown as ConfigService<EnvironmentVariables, true>;

  const service = new InvitationsService(
    db as unknown as PrismaService,
    passwords,
    accessService as unknown as AccessService,
    config,
  );
  return { service, db };
}

describe('InvitationsService.create', () => {
  const dto = { memberId: 'mem1', email: 'new@example.com' };

  it('refuses a caller without the permission and writes nothing', async () => {
    const { service, db } = setup({ permissions: [] });
    await expect(service.create('acc1', dto, NOW)).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
    });
    expect(db.invitation.create).not.toHaveBeenCalled();
  });

  it('treats a member of another club as not found', async () => {
    const { service, db } = setup();
    db.member.findFirst.mockResolvedValueOnce(null);
    await expect(service.create('acc1', dto, NOW)).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
    });
  });

  it('stores only the hash of the token and returns the link', async () => {
    const { service, db } = setup();
    const { link } = await service.create('acc1', dto, NOW);

    const url = new URL(link);
    const token = url.searchParams.get('token') ?? '';
    expect(`${url.origin}${url.pathname}`).toBe(
      'http://localhost:3000/accept-invitation',
    );
    expect(token).toHaveLength(43);

    const stored = JSON.stringify(db.invitation.create.mock.calls[0]);
    expect(stored).toContain(hashInvitationToken(token));
    expect(stored).not.toContain(token);
  });
});

describe('InvitationsService.accept', () => {
  const body = { token: 'abc', password: 'a-long-password' };
  const row = (over: Record<string, unknown> = {}) => ({
    tokenHash: 'h',
    memberId: 'mem1',
    email: 'new@example.com',
    acceptedAt: null,
    expiresAt: new Date('2026-11-28T10:00:00Z'),
    member: { fullName: 'Ada Lovelace', account: null },
    club: { name: 'Lish Club' },
    ...over,
  });

  it('creates the account for the member and marks the invitation used', async () => {
    const { service, db } = setup();
    db.invitation.findUnique.mockResolvedValueOnce(row());

    await service.accept(body, NOW);

    expect(db.invitation.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ acceptedAt: null }),
      data: { acceptedAt: NOW },
    });
    expect(db.userAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          memberId: 'mem1',
          name: 'Ada Lovelace',
          email: 'new@example.com',
          passwordHash: 'HASHED',
        },
      }),
    );
  });

  it('rejects an expired invitation and creates no account', async () => {
    const { service, db } = setup();
    db.invitation.findUnique.mockResolvedValueOnce(
      row({ expiresAt: new Date('2026-11-20T10:00:00Z') }),
    );
    await expect(service.accept(body, NOW)).rejects.toMatchObject({
      code: ErrorCode.INVITATION_EXPIRED,
    });
    expect(db.userAccount.create).not.toHaveBeenCalled();
  });

  it('rejects an invitation that was already used', async () => {
    const { service, db } = setup();
    db.invitation.findUnique.mockResolvedValueOnce(
      row({ acceptedAt: new Date('2026-11-20T10:00:00Z') }),
    );
    await expect(service.accept(body, NOW)).rejects.toMatchObject({
      code: ErrorCode.INVITATION_USED,
    });
  });
});
