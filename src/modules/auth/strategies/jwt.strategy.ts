import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { EnvironmentVariables } from '../../../config/env.validation';
import { PrismaService } from '../../../prisma/prisma.service';
import { publicUserSelect, type PublicUser } from '../../users/users.select';

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
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
    });
  }

  /**
   * Passport calls this only after the signature and expiry check out.
   * The return value is attached to `request.user`. Because it runs on
   * every request, this is where step 6 will load the current-term positions.
   */
  async validate(payload: JwtPayload): Promise<PublicUser> {
    const user = await this.prisma.userAccount.findUnique({
      where: { id: payload.sub },
      select: publicUserSelect,
    });
    // Token is valid but the account no longer exists.
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
