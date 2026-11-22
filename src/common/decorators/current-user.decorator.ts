import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../../modules/auth/auth-user';

/**
 * Injects the authenticated user (set by the JWT strategy's validate()).
 * Pass a field name to get a single property: `@CurrentUser('id') userId: string`.
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    return field ? request.user?.[field] : request.user;
  },
);
