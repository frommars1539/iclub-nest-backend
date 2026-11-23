import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainException } from '../../common/errors/domain.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import {
  LOGIN_MAX_FAILURES,
  loginKey,
  throttleDecision,
  windowStart,
} from './login-throttle.rules';

@Injectable()
export class LoginThrottleService {
  constructor(private readonly prisma: PrismaService) {}

  /** Throws 429 RATE_LIMITED when the account already has 10 recent failures. */
  async assertAllowed(email: string, now = new Date()): Promise<void> {
    const recent = await this.prisma.loginFailure.findMany({
      where: { keyHash: loginKey(email), at: { gt: windowStart(now) } },
      orderBy: { at: 'desc' },
      take: LOGIN_MAX_FAILURES,
      select: { at: true },
    });

    const decision = throttleDecision(
      recent.map((row) => row.at),
      now,
    );
    if (decision.blocked) {
      throw new DomainException(
        ErrorCode.RATE_LIMITED,
        'Too many failed sign-in attempts. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
        { retryAfterSeconds: decision.retryAfterSeconds },
      );
    }
  }

  /** Records one failure and drops this key's expired rows in the same step. */
  async recordFailure(email: string, now = new Date()): Promise<void> {
    const keyHash = loginKey(email);
    await this.prisma.$transaction([
      this.prisma.loginFailure.deleteMany({
        where: { keyHash, at: { lte: windowStart(now) } },
      }),
      this.prisma.loginFailure.create({ data: { keyHash, at: now } }),
    ]);
  }

  /** A successful sign-in clears the account's failures. */
  async reset(email: string): Promise<void> {
    await this.prisma.loginFailure.deleteMany({
      where: { keyHash: loginKey(email) },
    });
  }
}
