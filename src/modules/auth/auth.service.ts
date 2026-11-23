import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { publicUserSelect } from '../users/users.select';
import { SignInDto, SignUpDto } from './dto';
import { LoginThrottleService } from './login-throttle.service';
import { PasswordService } from './password.service';
import type { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly passwords: PasswordService,
    private readonly throttle: LoginThrottleService,
  ) {}

  /**
   * Creates a club-less account. The club (and the account's member) come
   * from POST /clubs, or from accepting an invitation.
   */
  async signUp({ password, ...profile }: SignUpDto) {
    const passwordHash = await this.passwords.hash(password);

    try {
      return await this.prisma.userAccount.create({
        data: { ...profile, passwordHash },
        select: publicUserSelect,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }

  async signIn({ email, password }: SignInDto, now = new Date()) {
    // NFR-015: refuse before doing any work, even for the correct password.
    await this.throttle.assertAllowed(email, now);

    const account = await this.prisma.userAccount.findUnique({
      where: { email },
    });

    // Always run a full Argon2 verification, even when the email is unknown
    // (it checks a decoy hash), so response time doesn't reveal which emails
    // are registered. Same error either way.
    const valid = await this.passwords.verifyOrDecoy(
      account?.passwordHash,
      password,
    );
    if (!account || !valid) {
      // Unknown emails count too, so a lock can't reveal which exist.
      await this.throttle.recordFailure(email, now);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.throttle.reset(email);
    return this.signToken({ sub: account.id, email: account.email });
  }

  private async signToken(payload: JwtPayload) {
    return { access_token: await this.jwt.signAsync(payload) };
  }
}
