import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { EnvironmentVariables } from '../../../config/env.validation';
import { PrismaService } from '../../../prisma/prisma.service';
import { AccessService } from '../../access/access.service';
import { publicUserSelect } from '../../users/users.select';
import type { AuthUser } from '../auth-user';

/** Identity only. Permissions are never in the token (SRS FR-022/023). */
export interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService<EnvironmentVariables, true>,
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
    });
  }

  /**
   * Passport calls this only after the signature and expiry check out. It
   * runs on every authenticated request, so what it returns (attached to
   * `request.user`) is always the caller's CURRENT access.
   */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    const account = await this.prisma.userAccount.findUnique({
      where: { id: payload.sub },
      select: {
        ...publicUserSelect,
        member: { select: { id: true, clubId: true, status: true } },
      },
    });
    // Token is valid but the account no longer exists.
    if (!account) throw new UnauthorizedException();

    const { member, ...user } = account;
    const access = await this.access.forMember(member);
    return { ...user, ...access };
  }
}
