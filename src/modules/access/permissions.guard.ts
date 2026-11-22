import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { DomainException } from '../../common/errors/domain.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import type { AuthUser } from '../auth/auth-user';
import { REQUIRED_PERMISSIONS_KEY } from './require-permission.decorator';
import type { Permission } from './permissions';

/**
 * Registered globally, right after JwtAuthGuard. A route with no
 * @RequirePermission passes through (it is still behind the JWT guard).
 * A route that declares one fails closed: no user means 401, and a missing
 * permission means 403.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const user = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>().user;
    if (!user) {
      throw new DomainException(
        ErrorCode.UNAUTHENTICATED,
        'Authentication is required.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (
      !required.every((permission) => user.permissions.includes(permission))
    ) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'You do not have permission to do this.',
        HttpStatus.FORBIDDEN,
      );
    }
    return true;
  }
}
