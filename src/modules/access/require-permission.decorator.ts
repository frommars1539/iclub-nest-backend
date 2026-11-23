import { SetMetadata } from '@nestjs/common';
import type { Permission } from './permissions';

export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';

/**
 * Declares what a route (or a whole controller) needs. The caller must hold
 * ALL the listed permissions. Enforced by PermissionsGuard.
 */
export const RequirePermission = (...permissions: Permission[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
