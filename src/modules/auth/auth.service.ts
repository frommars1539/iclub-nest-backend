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
import { PasswordService } from './password.service';
import type { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly passwords: PasswordService,
  ) {}

  /**
   * TEMPORARY bridge so the build is green. It creates an account with no
   * member and therefore no club. Step 4 replaces it with club registration
   * (FR-001) and invitation acceptance.
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

  async signIn({ email, password }: SignInDto) {
    const account = await this.prisma.userAccount.findUnique({
      where: { email },
    });

    // Same error for unknown email and wrong password, to avoid account
    // enumeration. (Timing still differs; step 3 fixes that.)
    if (
      !account ||
      !(await this.passwords.verify(account.passwordHash, password))
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.signToken({ sub: account.id, email: account.email });
  }

  private async signToken(payload: JwtPayload) {
    return { access_token: await this.jwt.signAsync(payload) };
  }
}
