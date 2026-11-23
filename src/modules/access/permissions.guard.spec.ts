import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DomainException } from '../../common/errors/domain.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import type { AuthUser } from '../auth/auth-user';
import { PermissionsGuard } from './permissions.guard';
import type { Permission } from './permissions';
import { RequirePermission } from './require-permission.decorator';

const guard = new PermissionsGuard(new Reflector());

/** A handler function carrying (or not) the permission metadata. */
function handler(...required: Permission[]) {
  const fn = () => undefined;
  if (required.length > 0) RequirePermission(...required)(fn);
  return fn;
}

function context(
  fn: () => undefined,
  user?: { permissions: Permission[] },
): ExecutionContext {
  return {
    getHandler: () => fn,
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

const codeOf = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return (error as DomainException).code;
  }
  return undefined;
};

describe('PermissionsGuard', () => {
  it('lets a route with no declared permission through', () => {
    expect(guard.canActivate(context(handler(), undefined))).toBe(true);
  });

  it('allows a caller who holds the permission', () => {
    const ctx = context(handler('finance.post'), {
      permissions: ['finance.post', 'finance.view'],
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('refuses a caller who lacks the permission with FORBIDDEN', () => {
    const ctx = context(handler('finance.post'), {
      permissions: ['finance.view'],
    });
    expect(codeOf(() => guard.canActivate(ctx))).toBe(ErrorCode.FORBIDDEN);
  });

  it('requires ALL listed permissions', () => {
    const ctx = context(handler('finance.post', 'finance.view'), {
      permissions: ['finance.post'],
    });
    expect(codeOf(() => guard.canActivate(ctx))).toBe(ErrorCode.FORBIDDEN);
  });

  it('fails closed with UNAUTHENTICATED when there is no user', () => {
    const ctx = context(handler('finance.post'), undefined);
    expect(codeOf(() => guard.canActivate(ctx))).toBe(
      ErrorCode.UNAUTHENTICATED,
    );
  });
});

// Compile-time check that the guard reads the same shape validate() returns.
export type _GuardUserShape = Pick<AuthUser, 'permissions'>;
