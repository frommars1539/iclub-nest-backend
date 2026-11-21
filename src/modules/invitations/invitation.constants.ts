import type { Permission } from '../access/permissions';

/** Who may invite members to create an account. Assumption: confirm with the team. */
export const INVITE_PERMISSION: Permission = 'leadership.manage';

/** Assumption: the SRS does not say how long an invitation lives. */
export const INVITATION_TTL_DAYS = 7;

/** The frontend route that handles the link (ROUTES.acceptInvitation). */
export const ACCEPT_INVITATION_PATH = '/accept-invitation';
