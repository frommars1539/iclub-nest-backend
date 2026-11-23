export interface HandoverParties {
  outgoingMemberId: string;
  incomingMemberId: string;
}

/**
 * Which side(s) of a handover this member is. The same member can be both
 * (an officer re-appointed to the same office), so these are independent flags.
 */
export function partyRoles(handover: HandoverParties, memberId: string) {
  return {
    outgoing: handover.outgoingMemberId === memberId,
    incoming: handover.incomingMemberId === memberId,
  };
}

/**
 * The database refuses to close a handover without both confirmations or
 * with unmarked items; this mirrors that so the client can show the state.
 */
export function isReadyToClose(
  handover: {
    closedAt: Date | null;
    outgoingConfirmedAt: Date | null;
    incomingConfirmedAt: Date | null;
  },
  unmarkedItems: number,
): boolean {
  return (
    handover.closedAt === null &&
    handover.outgoingConfirmedAt !== null &&
    handover.incomingConfirmedAt !== null &&
    unmarkedItems === 0
  );
}
