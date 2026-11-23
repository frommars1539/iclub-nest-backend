import { isReadyToClose, partyRoles } from './handover.rules';

const parties = { outgoingMemberId: 'ada', incomingMemberId: 'bob' };

describe('partyRoles', () => {
  it('identifies the outgoing and incoming members', () => {
    expect(partyRoles(parties, 'ada')).toEqual({
      outgoing: true,
      incoming: false,
    });
    expect(partyRoles(parties, 'bob')).toEqual({
      outgoing: false,
      incoming: true,
    });
  });

  it('gives a stranger no role', () => {
    expect(partyRoles(parties, 'eve')).toEqual({
      outgoing: false,
      incoming: false,
    });
  });

  it('lets one member be both sides', () => {
    const same = { outgoingMemberId: 'ada', incomingMemberId: 'ada' };
    expect(partyRoles(same, 'ada')).toEqual({ outgoing: true, incoming: true });
  });
});

describe('isReadyToClose', () => {
  const at = new Date('2026-11-21T10:00:00Z');
  const both = {
    closedAt: null,
    outgoingConfirmedAt: at,
    incomingConfirmedAt: at,
  };

  it('is ready only with both confirmations and nothing unmarked', () => {
    expect(isReadyToClose(both, 0)).toBe(true);
    expect(isReadyToClose(both, 2)).toBe(false);
    expect(isReadyToClose({ ...both, incomingConfirmedAt: null }, 0)).toBe(
      false,
    );
    expect(isReadyToClose({ ...both, outgoingConfirmedAt: null }, 0)).toBe(
      false,
    );
  });

  it('is never ready once closed', () => {
    expect(isReadyToClose({ ...both, closedAt: at }, 0)).toBe(false);
  });
});
