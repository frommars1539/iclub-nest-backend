export type InvitationState = 'valid' | 'used' | 'expired';

export function invitationState(
  invitation: { acceptedAt: Date | null; expiresAt: Date },
  now: Date,
): InvitationState {
  if (invitation.acceptedAt) return 'used';
  if (invitation.expiresAt.getTime() <= now.getTime()) return 'expired';
  return 'valid';
}
