import { invitationState } from './invitation.rules';

const now = new Date('2026-11-21T10:00:00Z');

describe('invitationState', () => {
  it('is valid before expiry and unused', () => {
    expect(
      invitationState(
        { acceptedAt: null, expiresAt: new Date('2026-11-28T10:00:00Z') },
        now,
      ),
    ).toBe('valid');
  });

  it('is expired at the expiry instant', () => {
    expect(invitationState({ acceptedAt: null, expiresAt: now }, now)).toBe(
      'expired',
    );
  });

  it('is used once accepted, even if it has also expired', () => {
    expect(
      invitationState(
        { acceptedAt: new Date('2026-11-20T10:00:00Z'), expiresAt: now },
        now,
      ),
    ).toBe('used');
  });
});
