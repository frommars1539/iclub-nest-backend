import { jest } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';
import type { LoginThrottleService } from './login-throttle.service';
import { PasswordService } from './password.service';

const NOW = new Date('2026-11-21T10:00:00Z');

describe('AuthService.signIn', () => {
  const findUnique = jest.fn<(args: unknown) => Promise<unknown>>();
  const prisma = { userAccount: { findUnique } } as unknown as PrismaService;
  const signAsync = jest.fn<(payload: unknown) => Promise<string>>();
  const jwt = { signAsync } as unknown as JwtService;
  const passwords = new PasswordService();
  const assertAllowed = jest.fn<(email: string, now: Date) => Promise<void>>();
  const recordFailure = jest.fn<(email: string, now: Date) => Promise<void>>();
  const reset = jest.fn<(email: string) => Promise<void>>();
  const throttle = {
    assertAllowed,
    recordFailure,
    reset,
  } as unknown as LoginThrottleService;
  const service = new AuthService(prisma, jwt, passwords, throttle);

  beforeEach(() => {
    findUnique.mockReset();
    signAsync.mockReset();
    signAsync.mockResolvedValue('jwt-token');
    assertAllowed.mockReset();
    assertAllowed.mockResolvedValue(undefined);
    recordFailure.mockReset();
    recordFailure.mockResolvedValue(undefined);
    reset.mockReset();
    reset.mockResolvedValue(undefined);
  });

  it('still runs a password verification when the email is unknown, and records the failure', async () => {
    findUnique.mockResolvedValue(null);
    const spy = jest.spyOn(passwords, 'verifyOrDecoy');

    await expect(
      service.signIn(
        { email: 'nobody@example.com', password: 'whatever12' },
        NOW,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    // No account -> hash is undefined -> the decoy path runs.
    expect(spy).toHaveBeenCalledWith(undefined, 'whatever12');
    expect(recordFailure).toHaveBeenCalledWith('nobody@example.com', NOW);
    spy.mockRestore();
  });

  it('gives the same error for a wrong password on a real account, and records it', async () => {
    const passwordHash = await passwords.hash('the-real-password');
    findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@example.com',
      passwordHash,
    });

    await expect(
      service.signIn(
        { email: 'a@example.com', password: 'wrong-password' },
        NOW,
      ),
    ).rejects.toThrow('Invalid credentials');
    expect(recordFailure).toHaveBeenCalledWith('a@example.com', NOW);
  });

  it('refuses a blocked account before looking it up or verifying anything', async () => {
    assertAllowed.mockRejectedValue(new Error('blocked'));

    await expect(
      service.signIn(
        { email: 'a@example.com', password: 'the-real-password' },
        NOW,
      ),
    ).rejects.toThrow('blocked');

    expect(findUnique).not.toHaveBeenCalled();
    expect(recordFailure).not.toHaveBeenCalled();
  });

  it('signs in, clears the failure count and records nothing on success', async () => {
    const passwordHash = await passwords.hash('the-real-password');
    findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@example.com',
      passwordHash,
    });

    await expect(
      service.signIn(
        { email: 'a@example.com', password: 'the-real-password' },
        NOW,
      ),
    ).resolves.toEqual({ access_token: 'jwt-token' });

    expect(reset).toHaveBeenCalledWith('a@example.com');
    expect(recordFailure).not.toHaveBeenCalled();
  });
});
