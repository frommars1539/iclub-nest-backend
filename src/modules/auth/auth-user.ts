import type { AccountAccess } from '../access/access.service';
import type { PublicUser } from '../users/users.select';

/** The authenticated caller: account fields plus access resolved on this request. */
export type AuthUser = PublicUser & AccountAccess;
