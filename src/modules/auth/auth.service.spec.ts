import { UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import { jest } from '@jest/globals';
import type { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';

describe('AuthService.signIn', () => {
  const findUnique = jest.fn<(args: unknown) => Promise<unknown>>();
  const prisma = { userAccount: { findUnique } } as unknown as PrismaService;
  const jwt = {
    signAsync: jest.fn<(payload: unknown) => Promise<string>>(),
  } as unknown as JwtService;
  const passwords = new PasswordService();
  const service = new AuthService(prisma, jwt, passwords);

  beforeEach(() => {
    findUnique.mockReset();
  });

  it('still runs a password verification when the email is unknown', async () => {
    findUnique.mockResolvedValue(null);
    const spy = jest.spyOn(passwords, 'verifyOrDecoy');

    await expect(
      service.signIn({ email: 'nobody@example.com', password: 'whatever12' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    // No account -> hash is undefined -> the decoy path runs.
    expect(spy).toHaveBeenCalledWith(undefined, 'whatever12');
    spy.mockRestore();
  });

  it('gives the same error for a wrong password on a real account', async () => {
    const passwordHash = await passwords.hash('the-real-password');
    findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@example.com',
      passwordHash,
    });

    await expect(
      service.signIn({ email: 'a@example.com', password: 'wrong-password' }),
    ).rejects.toThrow('Invalid credentials');
  });
});
