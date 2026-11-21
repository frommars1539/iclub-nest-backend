import {
  generateInvitationToken,
  hashInvitationToken,
} from './invitation-token';

describe('invitation tokens', () => {
  it('generates a long, unique, URL-safe token', () => {
    const a = generateInvitationToken();
    const b = generateInvitationToken();
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.token).not.toBe(b.token);
  });

  it('stores a SHA-256 hex digest that is not the token itself', () => {
    const { token, tokenHash } = generateInvitationToken();
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).not.toContain(token);
    expect(hashInvitationToken(token)).toBe(tokenHash);
  });
});
